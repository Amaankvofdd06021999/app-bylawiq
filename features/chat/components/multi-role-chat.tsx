'use client';

import { useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button, Card, Input } from '@/components/ui';
import { Send, Loader, AlertCircle, Copy, Download } from 'lucide-react';
import type { ChatRole } from '../multi-role-chats';

interface MultiRoleChatProps {
  role: ChatRole;
  buildingId?: string;
  buildingName?: string;
  buildingIds?: string[];
  title?: string;
  showSources?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    chunkId: string;
    title: string;
    content: string;
    sectionRef?: string;
  }>;
  citations?: number[];
}

export function MultiRoleChat({
  role,
  buildingId,
  buildingName,
  buildingIds,
  title = 'Chat',
  showSources = true,
}: MultiRoleChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const { messages: chatMessages, input: chatInput, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    onError: (error) => {
      setError(error.message);
    },
    onFinish: () => {
      setIsLoading(false);
    },
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await handleSubmit(e);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsLoading(false);
    }
  };

  const roleBadge: Record<ChatRole, { label: string; color: string }> = {
    resident: { label: 'Resident', color: 'bg-blue-100 text-blue-800' },
    building_manager: { label: 'Building Manager', color: 'bg-purple-100 text-purple-800' },
    strata_manager: { label: 'Strata Manager', color: 'bg-green-100 text-green-800' },
    firm_owner: { label: 'Firm Owner', color: 'bg-orange-100 text-orange-800' },
    platform_admin: { label: 'Platform Admin', color: 'bg-red-100 text-red-800' },
  };

  const badge = roleBadge[role];

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-info">
          <h2>{title}</h2>
          <span className={`badge ${badge.color}`}>{badge.label}</span>
          {buildingName && <p className="building-name">{buildingName}</p>}
          {buildingIds && buildingIds.length > 1 && (
            <p className="building-count">{buildingIds.length} buildings in portfolio</p>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {chatMessages.length === 0 && (
          <div className="empty-state">
            <p>Start a conversation</p>
            <p className="text-sm text-gray-500">
              Ask questions about
              {role === 'resident'
                ? ' your building'
                : role === 'strata_manager'
                  ? ' your portfolio'
                  : role === 'firm_owner'
                    ? ' your organization'
                    : ' the platform'}
            </p>
          </div>
        )}

        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            <div className="message-role">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <p>{msg.content}</p>

              {msg.role === 'assistant' && showSources && (
                <div className="message-sources">
                  {/* Sources would be rendered here if available */}
                </div>
              )}
            </div>
            {msg.role === 'assistant' && (
              <div className="message-actions">
                <button className="icon-btn" title="Copy">
                  <Copy size={16} />
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message message-assistant loading">
            <Loader size={20} className="animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <form onSubmit={onSubmit} className="chat-input-form">
        <div className="input-group">
          <Input
            value={chatInput}
            onChange={handleInputChange}
            placeholder={
              role === 'resident'
                ? 'Ask about your building (2 free, then $2 each)'
                : 'What would you like to know?'
            }
            disabled={isLoading}
            maxLength={5000}
          />
          <Button
            type="submit"
            disabled={isLoading || !chatInput.trim()}
            className="send-button"
          >
            <Send size={18} />
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
        <div className="input-hint">
          {role === 'resident' && (
            <p>Legal disclaimer: Responses are verified but not legal advice</p>
          )}
          {role === 'strata_manager' && (
            <p>Searching across all your buildings</p>
          )}
        </div>
      </form>

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 1rem;
          background: white;
          border-radius: 8px;
        }

        .chat-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-info h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-right: 0.5rem;
        }

        .building-name {
          margin: 0.5rem 0 0 0;
          color: #666;
          font-size: 0.875rem;
        }

        .building-count {
          margin: 0.25rem 0 0 0;
          color: #999;
          font-size: 0.8rem;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #999;
          text-align: center;
        }

        .empty-state p:first-child {
          font-size: 1.125rem;
          font-weight: 500;
          color: #333;
        }

        .message {
          display: flex;
          gap: 0.75rem;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message-user {
          justify-content: flex-end;
        }

        .message-user .message-content {
          background: #3b82f6;
          color: white;
        }

        .message-assistant .message-content {
          background: #f3f4f6;
          color: #1f2937;
        }

        .message.loading {
          align-items: center;
          gap: 0.5rem;
          color: #666;
        }

        .message-role {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .message-content {
          padding: 0.75rem 1rem;
          border-radius: 6px;
          max-width: 80%;
          word-wrap: break-word;
        }

        .message-content p {
          margin: 0;
          line-height: 1.5;
        }

        .message-sources {
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 0.875rem;
          opacity: 0.8;
        }

        .message-actions {
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .message:hover .message-actions {
          opacity: 1;
        }

        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          color: #666;
          transition: color 0.2s;
        }

        .icon-btn:hover {
          color: #333;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
          margin: 0 1.5rem;
        }

        .error-banner button {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          color: #dc2626;
          font-weight: 600;
          font-size: 0.75rem;
        }

        .chat-input-form {
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 0 0 8px 8px;
        }

        .input-group {
          display: flex;
          gap: 0.75rem;
        }

        .input-group input {
          flex: 1;
        }

        .send-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
        }

        .input-hint {
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: #666;
        }

        .input-hint p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
