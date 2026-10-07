'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Zap } from 'lucide-react';
import { Button, Input, Card, Badge } from '@/components/ui';
import { getResidentChatStateAction, spendCreditAction } from '../resident-chat-actions';
import { sendResidentChatMessageAction } from '../resident-chat-gated-actions';
import type { ChatMessage, ResidentChatState } from '../resident-chat-schema';

interface ResidentChatUIProps {
  buildingId: string;
  buildingName: string;
  onPaywallNeeded?: () => void;
}

export function ResidentChatUI({ buildingId, buildingName, onPaywallNeeded }: ResidentChatUIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatState, setChatState] = useState<ResidentChatState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat state on mount
  useEffect(() => {
    async function loadState() {
      const result = await getResidentChatStateAction(buildingId);
      if (result.ok) {
        setChatState(result.state);
      }
      setLoading(false);
    }
    loadState();
  }, [buildingId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy || !chatState) return;

    setError('');
    setBusy(true);

    // Check if we need to spend credits
    const creditResult = await spendCreditAction({
      buildingId,
      action: 'question',
    });

    if (!creditResult.ok) {
      setError(creditResult.error);
      setBusy(false);
      return;
    }

    if (creditResult.outcome === 'paywall') {
      onPaywallNeeded?.();
      setBusy(false);
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: input,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userQuestion = input;
    setInput('');

    // Call actual chat API
    try {
      const result = await sendResidentChatMessageAction({
        buildingId,
        message: userQuestion,
        chatId: chatState.chatId,
      });

      if (!result.ok) {
        setError(result.error || 'Failed to get response');
        setBusy(false);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        content: result.response.content,
        role: 'assistant',
        sources: result.response.sources || [],
        verification: result.response.verification,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update chat state after message
      const stateResult = await getResidentChatStateAction(buildingId);
      if (stateResult.ok) {
        setChatState(stateResult.state);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="chat-loading">Loading chat...</div>;
  }

  if (!chatState) {
    return <div className="chat-error">Failed to load chat</div>;
  }

  const freeQuestionsLeft = 2 - chatState.free_questions_used;
  const canAsk = freeQuestionsLeft > 0 || chatState.credits > 0;

  return (
    <div className="resident-chat-ui">
      {/* Legal Disclaimer - Non-dismissible */}
      <Card className="legal-disclaimer">
        <div className="disclaimer-header">
          <AlertCircle size={18} />
          <h4>Legal Information</h4>
        </div>
        <p>
          This AI assistant provides information based on {buildingName}'s bylaws and applicable BC
          strata law. The information is not legal advice. Consult a lawyer before taking action.
          Responses are based on provided documents and may not cover all situations.
        </p>
      </Card>

      {/* Credit Status */}
      <div className="credit-status">
        <div className="credit-item">
          <Zap size={16} />
          <div>
            <span className="credit-label">Free Questions</span>
            <span className="credit-value">{freeQuestionsLeft}/2</span>
          </div>
        </div>
        <div className="credit-item">
          <Zap size={16} />
          <div>
            <span className="credit-label">Credits</span>
            <span className="credit-value">{chatState.credits}</span>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <h3>Ask about {buildingName}</h3>
            <p>Get answers about bylaws, policies, and procedures grounded in your building's documents.</p>
            <div className="example-questions">
              <p className="text-small">Example questions:</p>
              <ul>
                <li>"What are the parking rules?"</li>
                <li>"What is the pet policy?"</li>
                <li>"Can I rent out my unit?"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-content">{msg.content}</div>

            {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
              <div className="message-sources">
                <p className="sources-label">Sources:</p>
                <ul>
                  {msg.sources.map((source) => (
                    <li key={source.chunk_id}>
                      <a href={`#doc-${source.document_id}`}>
                        {source.document_title}
                        {source.relevance && <span>({Math.round(source.relevance * 100)}%)</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="message message-assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="chat-form">
        <div className="form-input-group">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              freeQuestionsLeft > 0
                ? `Ask about ${buildingName}... (${freeQuestionsLeft} free questions left)`
                : `Ask about ${buildingName}... (costs 1 credit)`
            }
            disabled={busy || !canAsk}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || busy || !canAsk}
            busy={busy}
          >
            <Send size={16} />
            Ask
          </Button>
        </div>

        {!canAsk && (
          <p className="form-note text-warning">
            ⚠️ No credits available. Purchase credits to continue asking questions.
          </p>
        )}
      </form>

      <style jsx>{`
        .resident-chat-ui {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 1rem;
        }

        .legal-disclaimer {
          border-left: 4px solid var(--color-error);
          background: #fef5f5;
          padding: 1rem;
        }

        .disclaimer-header {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 0.75rem;
          color: var(--color-error);
          font-weight: 600;
        }

        .legal-disclaimer p {
          margin: 0;
          font-size: 0.875rem;
          line-height: 1.5;
          color: var(--color-text);
        }

        .credit-status {
          display: flex;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
        }

        .credit-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .credit-item svg {
          color: var(--color-accent);
        }

        .credit-label {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .credit-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-primary);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }

        .empty-state h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
        }

        .empty-state p {
          margin: 0 0 1.5rem 0;
          color: var(--color-text-secondary);
        }

        .example-questions {
          text-align: left;
        }

        .example-questions .text-small {
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .example-questions ul {
          margin: 0.75rem 0 0 1.5rem;
          padding: 0;
          list-style: disc;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 80%;
          word-wrap: break-word;
        }

        .message-user {
          align-self: flex-end;
        }

        .message-assistant {
          align-self: flex-start;
        }

        .message-content {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          line-height: 1.5;
        }

        .message-user .message-content {
          background: var(--color-accent);
          color: white;
        }

        .message-assistant .message-content {
          background: var(--color-bg-secondary);
          color: var(--color-text);
        }

        .message-assistant.loading .message-content {
          padding: 1rem;
        }

        .typing-indicator {
          display: flex;
          gap: 0.25rem;
          align-items: center;
          height: 1rem;
        }

        .typing-indicator span {
          width: 0.5rem;
          height: 0.5rem;
          background: var(--color-text-secondary);
          border-radius: 50%;
          animation: pulse 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes pulse {
          0%,
          60%,
          100% {
            opacity: 0.5;
          }
          30% {
            opacity: 1;
          }
        }

        .message-sources {
          padding: 0.5rem 0.75rem;
          background: #f5f5f5;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
        }

        .sources-label {
          margin: 0 0 0.25rem 0;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .message-sources ul {
          margin: 0;
          padding: 0 0 0 1.25rem;
          list-style: disc;
        }

        .message-sources li {
          margin: 0.25rem 0;
        }

        .message-sources a {
          color: var(--color-accent);
          text-decoration: none;
        }

        .message-sources a:hover {
          text-decoration: underline;
        }

        .chat-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-input-group {
          display: flex;
          gap: 0.5rem;
        }

        .form-input-group input {
          flex: 1;
        }

        .form-note {
          margin: 0;
          font-size: 0.875rem;
        }

        .text-warning {
          color: #d97706;
        }

        @media (max-width: 768px) {
          .message {
            max-width: 95%;
          }

          .credit-status {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
