'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Spinner, Modal } from '@heroui/react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';
import type { ChatMessage, GeneratedStrategy, StrategyRecord } from '@/types/strategy';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Strip the ```strategy_json block from display text. */
function stripStrategyBlock(text: string): string {
  return text.replace(/```strategy_json\s*\n[\s\S]*?\n```/g, '').trim();
}

/** Extract a GeneratedStrategy from an assistant message. */
function extractStrategy(text: string): GeneratedStrategy | null {
  const match = text.match(/```strategy_json\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.name && parsed.code && parsed.summary) return parsed as GeneratedStrategy;
  } catch {}
  return null;
}

/**
 * Build the synthetic "edit mode" opening message that shows the user
 * exactly what their current strategy does before asking how to improve it.
 * Attaches the strategy as a generatedStrategy so it renders as a rich card.
 */
function buildEditIntroMessage(strategy: StrategyRecord): ChatMessage {
  const content = [
    `Here\'s your current strategy — **${strategy.name}**:`,
    '',
    'Take a look at the conditions below. How would you like to improve or modify this strategy? For example:',
    '  • Add a step-up buy when position gains X%',
    '  • Tighten or loosen the stop-loss percentage',
    '  • Add a partial profit-taking level',
    '  • Switch to a different entry indicator',
    '  • Add portfolio-level constraints (max positions, etc.)',
  ].join('\n');

  return {
    role: 'assistant',
    content,
    generatedStrategy: {
      name: strategy.name,
      code: strategy.generatedCode,
      summary: strategy.description,
    },
  };
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StrategyBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;
  const isNew = strategyId === 'new';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategyName, setStrategyName] = useState('');
  const [generatedStrategy, setGeneratedStrategy] = useState<GeneratedStrategy | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!isNew);
  const [currentStrategyId, setCurrentStrategyId] = useState<string | null>(isNew ? null : strategyId);
  const [user, setUser] = useState<User | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load existing strategy
  useEffect(() => {
    if (!isNew && currentStrategyId) {
      fetch(`/api/strategy/${currentStrategyId}`)
        .then((res) => res.json())
        .then((data: StrategyRecord) => {
          setStrategyName(data.name);
          setGeneratedStrategy({ name: data.name, code: data.generatedCode, summary: data.description });

          if (data.chatHistory && data.chatHistory.length > 0) {
            // Restore prior conversation, but always prepend the current strategy intro
            // so the user always sees the latest strategy details at the top
            const introMsg = buildEditIntroMessage(data);
            // Check if first message already is a strategy intro (avoid duplicating on re-open)
            const existing = data.chatHistory;
            if (existing[0]?.generatedStrategy?.code === data.generatedCode) {
              setMessages(existing);
            } else {
              setMessages([introMsg, ...existing]);
            }

            // Also pick up the latest generated strategy from history
            for (let i = data.chatHistory.length - 1; i >= 0; i--) {
              if (data.chatHistory[i].generatedStrategy) {
                setGeneratedStrategy(data.chatHistory[i].generatedStrategy!);
                break;
              }
            }
          } else {
            // No chat history — show strategy details and ask for improvements
            const introMsg = buildEditIntroMessage(data);
            setMessages([introMsg]);
          }

          setInitialLoading(false);
        })
        .catch(() => {
          setError('Failed to load strategy');
          setInitialLoading(false);
        });
    }
  }, [isNew, strategyId]);

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/strategy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to get AI response');
      }

      const assistantMsg: ChatMessage = await res.json();
      const newMessages = [...updatedMessages, assistantMsg];
      setMessages(newMessages);

      if (assistantMsg.generatedStrategy) {
        setGeneratedStrategy(assistantMsg.generatedStrategy);
        setStrategyName(assistantMsg.generatedStrategy.name);
        
        // Auto-save the strategy
        setSaving(true);
        try {
          const payload = {
            name: assistantMsg.generatedStrategy.name,
            description: assistantMsg.generatedStrategy.summary,
            code: assistantMsg.generatedStrategy.code,
            chatHistory: newMessages,
          };

          const saveRes = await fetch(
            currentStrategyId ? `/api/strategy/${currentStrategyId}` : '/api/strategy',
            {
              method: currentStrategyId ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            },
          );

          if (saveRes.ok) {
            if (!currentStrategyId) {
              const savedData = await saveRes.json();
              if (savedData.id) {
                setCurrentStrategyId(savedData.id);
                window.history.replaceState(null, '', `/dashboard/strategy/${savedData.id}`);
              }
            }
          } else {
            console.error('Failed to auto-save strategy');
          }
        } catch (err) {
          console.error('Auto-save failed', err);
        } finally {
          setSaving(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with AI');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputValue, loading, messages, currentStrategyId]);

  const handleDelete = useCallback(async () => {
    if (!currentStrategyId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/strategy/${currentStrategyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete strategy');
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to delete strategy');
      setDeleting(false);
    }
  }, [currentStrategyId, router]);

  const handleClearChat = useCallback(async () => {
    
    // The first message is always the intro message containing the finalized strategy container
    const newMessages = messages.length > 0 ? [messages[0]] : [];
    setMessages(newMessages);

    // Auto-save the cleared history if it's an existing strategy
    if (currentStrategyId && generatedStrategy) {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/strategy/${currentStrategyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: generatedStrategy.name,
            description: generatedStrategy.summary,
            code: generatedStrategy.code,
            chatHistory: [], // Save empty array to DB so it doesn't restore old chat
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to clear chat history on server');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to clear chat history');
      } finally {
        setSaving(false);
      }
    }
  }, [messages, currentStrategyId, generatedStrategy]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted animate-pulse">Loading strategy…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border border-border hover:border-accent/40 hover:bg-accent/5 transition-all duration-200 text-muted hover:text-foreground"
            title="Back to dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
                {isNew ? 'Strategy Builder' : strategyName || 'Edit Strategy'}
              </h1>
              {!isNew && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-accent/10 text-accent border border-accent/20">
                  Editing
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1 hidden sm:block">
              {!currentStrategyId
                ? 'Describe your strategy — AI will ask questions and generate the code'
                : 'Refine your strategy through conversation'}
            </p>
          </div>
        </div>

        {generatedStrategy && (
          <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4 flex-wrap">
            {currentStrategyId && (
              <>
                <Modal>
                  <Button variant="ghost" className="h-9 px-3 text-sm">Clear Chat</Button>
                  <Modal.Backdrop>
                    <Modal.Container>
                      <Modal.Dialog>
                        <Modal.Header>
                          <Modal.Heading>Clear Chat History?</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                          <p className="text-sm text-muted">
                            Are you sure you want to clear the chat history? This won't delete the strategy itself — it just clears your conversation while keeping the final strategy shown.
                          </p>
                        </Modal.Body>
                        <Modal.Footer>
                          <Button slot="close" variant="ghost">Cancel</Button>
                          <Button slot="close" onPress={handleClearChat} variant="danger">Clear Chat</Button>
                        </Modal.Footer>
                        <Modal.CloseTrigger />
                      </Modal.Dialog>
                    </Modal.Container>
                  </Modal.Backdrop>
                </Modal>

                <Modal>
                  <Button isPending={deleting} variant="danger-soft" className="h-9 px-3 text-sm">Delete</Button>
                  <Modal.Backdrop>
                    <Modal.Container>
                      <Modal.Dialog>
                        <Modal.Header>
                          <Modal.Heading>Delete Strategy?</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                          <p className="text-sm text-muted">
                            Are you sure you want to delete this strategy? This action cannot be undone.
                          </p>
                        </Modal.Body>
                        <Modal.Footer>
                          <Button slot="close" variant="ghost">Cancel</Button>
                          <Button slot="close" onPress={handleDelete} variant="danger">Delete</Button>
                        </Modal.Footer>
                        <Modal.CloseTrigger />
                      </Modal.Dialog>
                    </Modal.Container>
                  </Modal.Backdrop>
                </Modal>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:text-foreground border border-border hover:border-accent/30 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              {showCode ? 'Hide Code' : 'View Code'}
            </button>

            <div className="flex items-center ml-2 border-l border-border/50 pl-3">
              {saving ? (
                <span className="text-xs text-muted flex items-center gap-2">
                  <Spinner size="sm" color="current" /> Saving...
                </span>
              ) : (
                <span className="text-xs text-success flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </span>
              )}
            </div>

            {!user && (
              <Button
                variant="outline"
                onPress={() => router.push('/login')}
                className="h-9 px-4 text-xs font-medium ml-1"
              >
                Login to save permanently
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Code Preview (collapsible) ───────────────────────── */}
      {showCode && generatedStrategy && (
        <div className="mb-4 flex-shrink-0 rounded-xl border border-border bg-black/90 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-2 text-xs text-white/40 font-mono">strategy.js</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCode(false)}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <pre className="p-4 text-xs text-green-400 font-mono overflow-x-auto max-h-48 leading-relaxed">
            {generatedStrategy.code}
          </pre>
        </div>
      )}

      {/* ── Chat Window ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm">
        <div className="p-6 space-y-6">

          {/* Empty state for new strategy */}
          {!currentStrategyId && messages.length === 0 && (
            <AssistantBubble>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  👋 Let&apos;s build your trading strategy
                </p>
                <p className="text-muted text-sm leading-relaxed mb-3">
                  Describe what you have in mind and I&apos;ll ask the right questions to turn it into working code.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    'Buy near 52-week high with trailing stop',
                    'RSI oversold bounce with partial profit taking',
                    'SMA crossover with pyramiding on winners',
                  ].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => { setInputValue(ex); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="text-left px-3 py-2 rounded-lg border border-border hover:border-accent/40 hover:bg-accent/5 text-xs text-muted hover:text-foreground transition-all duration-150"
                    >
                      &ldquo;{ex}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </AssistantBubble>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              <UserBubble key={`msg-${i}`} content={msg.content} />
            ) : (
              <AssistantBubble key={`msg-${i}`}>
                <FormattedContent content={msg.content} />
                {msg.generatedStrategy && (
                  <GeneratedStrategyCard strategy={msg.generatedStrategy} />
                )}
              </AssistantBubble>
            )
          ))}

          {/* Typing indicator */}
          {loading && (
            <AssistantBubble>
              <TypingDots />
            </AssistantBubble>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Input Bar ───────────────────────────────────────── */}
      <div className="mt-3 flex-shrink-0">
        <div className="flex gap-2 items-end rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm px-4 py-3 focus-within:border-accent/50 transition-colors duration-200">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={
              !currentStrategyId && messages.length === 0
                ? 'Describe your trading strategy…'
                : 'Type a message… (Enter to send, Shift+Enter for new line)'
            }
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '24px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!inputValue.trim() || loading}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-muted/50 mt-1.5">
          AI-generated code is validated before saving · Enter to send
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center text-sm">
        🤖
      </div>
      <div className="flex-1 min-w-0 bg-muted/5 border border-border/40 rounded-2xl rounded-tl-sm px-5 py-4 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 items-start flex-row-reverse">
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-sm">
        👤
      </div>
      <div className="max-w-[80%] bg-accent/10 border border-accent/15 rounded-2xl rounded-tr-sm px-5 py-4 text-sm leading-relaxed text-foreground">
        {content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted/50 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  );
}

/** Renders the text content of an assistant message with basic markdown-lite formatting. */
function FormattedContent({ content }: { content: string }) {
  const cleaned = stripStrategyBlock(content);
  if (!cleaned) return null;

  return (
    <div className="space-y-2">
      {cleaned.split('\n').map((line, i) => {
        // Bold headers like **Buy Conditions:**
        const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
        if (boldMatch) {
          return (
            <p key={i} className="font-semibold text-foreground mt-3 first:mt-0">
              {boldMatch[1]}
              <span className="font-normal text-muted">{boldMatch[2]}</span>
            </p>
          );
        }
        // Bullet points
        if (line.match(/^\s+[•·]\s/)) {
          return (
            <p key={i} className="text-muted pl-4 flex gap-2">
              <span className="text-accent/60 flex-shrink-0">•</span>
              <span>{line.replace(/^\s+[•·]\s/, '')}</span>
            </p>
          );
        }
        // Empty lines
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Regular text
        return <p key={i} className="text-foreground/80">{line}</p>;
      })}
    </div>
  );
}

function GeneratedStrategyCard({ strategy }: { strategy: GeneratedStrategy }) {
  const [expanded, setExpanded] = useState(false);

  const lines = strategy.summary.split('\n').filter(Boolean);
  const buyLines = lines.filter((l) => /buy|entry|long/i.test(l));
  const sellLines = lines.filter((l) => /sell|exit|stop|trail|profit/i.test(l));
  const otherLines = lines.filter((l) => !buyLines.includes(l) && !sellLines.includes(l));

  return (
    <div className="mt-4 rounded-xl border border-accent/25 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-accent/8 border-b border-accent/15">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="font-semibold text-sm text-foreground">{strategy.name}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-success/15 text-success border border-success/20">
            Generated
          </span>
        </div>
      </div>

      {/* Conditions */}
      <div className="px-4 py-3 space-y-3 bg-card/50">
        {buyLines.length > 0 && (
          <RuleGroup label="Buy Conditions" icon="↗" color="success" lines={buyLines} />
        )}
        {sellLines.length > 0 && (
          <RuleGroup label="Sell / Exit Conditions" icon="↘" color="danger" lines={sellLines} />
        )}
        {otherLines.length > 0 && (
          <RuleGroup label="Other Rules" icon="◎" color="accent" lines={otherLines} />
        )}

        {/* Code toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors font-medium mt-1 pt-2 border-t border-border/30 w-full"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
          {expanded ? 'Hide generated code' : 'View generated code'}
        </button>

        {expanded && (
          <div className="rounded-xl border border-white/10 bg-black/85 overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-1 text-[10px] text-white/30 font-mono">strategy.js</span>
            </div>
            <pre className="p-4 text-xs text-green-400 font-mono leading-relaxed overflow-x-auto">
              {strategy.code}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function RuleGroup({
  label, icon, color, lines,
}: {
  label: string;
  icon: string;
  color: 'success' | 'danger' | 'accent';
  lines: string[];
}) {
  const colorMap = {
    success: { bg: 'bg-success/5', border: 'border-success/15', text: 'text-success', dot: 'bg-success' },
    danger: { bg: 'bg-danger/5', border: 'border-danger/15', text: 'text-danger', dot: 'bg-danger' },
    accent: { bg: 'bg-accent/5', border: 'border-accent/15', text: 'text-accent', dot: 'bg-accent' },
  }[color];

  return (
    <div className={`rounded-lg border ${colorMap.bg} ${colorMap.border} px-3 py-2.5`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold ${colorMap.text}`}>{icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wider ${colorMap.text}`}>{label}</span>
      </div>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-xs text-muted flex gap-2 items-start">
            <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${colorMap.dot}`} />
            <span>{line.replace(/^[•→↗↘◎\-\*]\s*/u, '').replace(/^\*\*(.+?)\*\*/, '$1')}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
