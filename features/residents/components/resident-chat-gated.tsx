'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Zap, Shield } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { sendResidentChatMessageAction, getResidentActivityAuditAction } from '../resident-chat-gated-actions';
import { getResidentChatStateAction } from '../resident-chat-actions';
import { PaywallDialog } from './paywall-dialog';
import { LegalDisclaimer } from './legal-disclaimer';

interface ResidentChatGatedProps {
  buildingId: string;
  buildingName: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ documentId: string; relevance: number }>;
  timestamp: string;
}

export function ResidentChatGated({ buildingId, buildingName }: ResidentChatGatedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [credits, setCredits] = useState(0);
  const [freeQuestionsUsed, setFreeQuestionsUsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial state
  useEffect(() => {
    async function loadState() {
      const result = await getResidentChatStateAction(buildingId);
      if (result.ok) {
        setCredits(result.state.credits);
        setFreeQuestionsUsed(result.state.free_questions_used);
      }
      setLoading(false);
    }
    loadState();
  }, [buildingId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;

    setError('');
    setBusy(true);

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Send with verification gate
    const result = await sendResidentChatMessageAction({
      buildingId,
      message: input,
    });

    if (!result.ok) {
      setError(result.error);
      setBusy(false);

      // Check if it's paywall error
      if (result.error?.includes('No credits')) {
        setShowPaywall(true);
      }

      return;
    }

    // Add assistant response
    if (result.response) {
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: result.response.content,
        sources: result.response.sources,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCredits((prev) => Math.max(0, prev - 1));
    }

    setBusy(false);
  };

  if (loading) {
    return <div className="loading">Loading chat...</div>;
  }

  const freeQuestionsLeft = 2 - freeQuestionsUsed;
  const canAsk = freeQuestionsLeft > 0 || credits > 0;

  return (
    <div className="chat-container">
      {/* Legal Disclaimer - Always visible, non-dismissible */}
      <LegalDisclaimer buildingName={buildingName} />

      {/* Credit Status */}
      <div className="status-bar">
        <div className="status-item">
          <Zap size={16} />
          <span>Free: {freeQuestionsLeft}/2</span>
        </div>
        <div className="status-item">
          <Zap size={16} />
          <span>Credits: {credits}</span>
        </div>
        <div className="status-item">
          <Shield size={16} />
          <span>Verified responses only</span>
        </div>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <h3>Ask about {buildingName}</h3>
            <p>All responses are grounded in your building's documents and BC strata law.</p>
            <div className="example-questions">
              <p className="label">Example questions:</p>
              <ul>
                <li>"What are the parking rules?"</li>
                <li>"Can I rent out my unit?"</li>
                <li>"What is the pet policy?"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-text">{msg.content}</div>

            {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
              <div className="sources">
                <p className="label">Sources:</p>
                <ul>
                  {msg.sources.map((src) => (
                    <li key={src.documentId}>
                      {src.documentId} ({Math.round(src.relevance * 100)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {busy && <div className="message message-assistant loading">Thinking...</div>}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <Card className="error-card">
          <AlertCircle size={18} />
          <p>{error}</p>
        </Card>
      )}

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="form">
        <div className="input-group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canAsk ? 'Ask about ' + buildingName : 'No credits available'}
            disabled={busy || !canAsk}
          />
          <Button type="submit" disabled={!input.trim() || busy || !canAsk} busy={busy}>
            <Send size={16} />
          </Button>
        </div>

        {!canAsk && (
          <p className="notice">
            ⚠️ No free questions or credits left. Purchase credits to continue.
          </p>
        )}
      </form>

      {/* Paywall Dialog */}
      {showPaywall && (
        <div className="paywall-overlay" onClick={() => setShowPaywall(false)}>
          <Card className="paywall-card">
            <AlertCircle size={32} />
            <h2>Get Credits</h2>
            <p>You've used all your free questions.</p>
            <div className="credit-packages">
              {[50, 100, 250].map((amt) => (
                <button key={amt} className="package" onClick={() => setShowPaywall(false)}>
                  {amt} Credits
                </button>
              ))}
            </div>
            <Button onClick={() => setShowPaywall(false)}>Close</Button>
          </Card>
        </div>
      )}

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 1rem;
        }

        .status-bar {
          display: flex;
          gap: 1rem;
          padding: 0.75rem;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
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
        }

        .empty-state p {
          margin: 0 0 1.5rem 0;
          color: #666;
        }

        .example-questions {
          text-align: left;
        }

        .example-questions .label {
          font-weight: 600;
          font-size: 0.875rem;
        }

        .example-questions ul {
          margin: 0.75rem 0 0 1.5rem;
          padding: 0;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 80%;
        }

        .message-user {
          align-self: flex-end;
        }

        .message-assistant {
          align-self: flex-start;
        }

        .message-text {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          line-height: 1.5;
        }

        .message-user .message-text {
          background: #3b82f6;
          color: white;
        }

        .message-assistant .message-text {
          background: #f5f5f5;
        }

        .sources {
          padding: 0.5rem 0.75rem;
          background: #efefef;
          border-radius: 6px;
          font-size: 0.85rem;
        }

        .sources .label {
          margin: 0 0 0.25rem 0;
          font-weight: 600;
        }

        .sources ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .sources li {
          margin: 0.25rem 0;
        }

        .error-card {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: #fee;
          border-left: 4px solid #dc2626;
        }

        .error-card p {
          margin: 0;
          color: #c33;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group {
          display: flex;
          gap: 0.5rem;
        }

        .input-group input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-family: inherit;
        }

        .notice {
          margin: 0;
          font-size: 0.875rem;
          color: #d97706;
        }

        .paywall-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .paywall-card {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          text-align: center;
          max-width: 400px;
        }

        .credit-packages {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin: 1.5rem 0;
        }

        .package {
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .package:hover {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
        }
      `}</style>
    </div>
  );
}
