import { NextRequest } from 'next/server';
import { chatWithStrategyBuilder } from '@/lib/ai/gemini';
import type { ChatMessage } from '@/types/strategy';

/**
 * POST /api/strategy/chat
 *
 * Multi-turn conversation with Gemini strategy builder.
 * Body: { messages: ChatMessage[] }
 *
 * Returns the assistant's response as JSON.
 */
export async function POST(request: NextRequest) {
  let body: { messages: ChatMessage[] };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Messages array is required' }, { status: 400 });
  }

  try {
    const response = await chatWithStrategyBuilder(messages);
    return Response.json(response);
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    return Response.json(
      { error: err.message || 'Failed to communicate with AI' },
      { status: 500 },
    );
  }
}
