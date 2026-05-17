'use client';

import { useState } from 'react';
import { Button, Modal, TextArea, RadioGroup, Radio, Label } from '@heroui/react';

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('feature');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setContent('');
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onPress={() => setIsOpen(true)}
        className="text-muted hover:text-foreground font-medium text-xs border-0"
      >
        Feedback
      </Button>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />
              <Modal.Header className="flex flex-col gap-1">
                <Modal.Heading>Share your feedback</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {success ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Thank you!</h3>
                    <p className="text-sm text-muted mt-1">Your feedback has been submitted successfully.</p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-2">
                    <RadioGroup
                      value={type}
                      onChange={setType}
                      orientation="horizontal"
                      className="text-sm gap-4"
                    >
                      <Label className="text-sm font-medium">What kind of feedback do you have?</Label>
                      <Radio value="feature" className="text-sm">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Radio.Content>
                          <Label>Feature Request</Label>
                        </Radio.Content>
                      </Radio>
                      <Radio value="bug" className="text-sm">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Radio.Content>
                          <Label>Bug Report</Label>
                        </Radio.Content>
                      </Radio>
                    </RadioGroup>

                    <TextArea
                      placeholder={type === 'bug' ? "Please describe the issue you encountered..." : "What feature would you like to see?"}
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      variant="secondary"
                      className="w-full"
                    />

                    {error && (
                      <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </Modal.Body>
              {!success && (
                <Modal.Footer>
                  <Button variant="secondary" onPress={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onPress={handleSubmit}
                    isPending={isSubmitting}
                    isDisabled={!content.trim()}
                  >
                    Submit
                  </Button>
                </Modal.Footer>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
