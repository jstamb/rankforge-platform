import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, Send, Loader2, X, Minimize2, Maximize2,
  Bot, User, Sparkles, Code, Palette, FileText, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

interface WebsiteChatProps {
  websiteId: string;
  websiteName: string;
  onClose?: () => void;
  onJobCreated?: (jobId: string) => void;
}

const MAX_HISTORY_MESSAGES = 10;

const QUICK_ACTIONS = [
  { icon: Palette, label: 'Change colors', prompt: 'I want to change the color scheme of my website.' },
  { icon: FileText, label: 'Edit content', prompt: 'I want to edit the content on my homepage.' },
  { icon: Code, label: 'Add feature', prompt: 'I want to add a new feature to my website.' },
  { icon: RefreshCw, label: 'Regenerate page', prompt: 'Can you regenerate one of my pages with better content?' },
];

export const WebsiteChat: React.FC<WebsiteChatProps> = ({
  websiteId,
  websiteName,
  onClose,
  onJobCreated,
}) => {
  const welcomeMessage: Message = {
    id: '1',
    role: 'assistant',
    content: `Hi! I'm your AI website assistant. I can help you make changes to **${websiteName}**.\n\nI can help with:\n- Editing page content and copy\n- Changing colors and design elements\n- Adding new sections or pages\n- Improving SEO and keywords\n- Fixing issues you've noticed\n\nWhat would you like to change?`,
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from database on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('websites')
          .select('chat_history')
          .eq('id', websiteId)
          .single();

        if (error) {
          console.error('Error loading chat history:', error);
          return;
        }

        if (data?.chat_history && Array.isArray(data.chat_history) && data.chat_history.length > 0) {
          // Convert stored history to Message format
          const loadedMessages: Message[] = data.chat_history.map((msg: ChatMessage, index: number) => ({
            id: `history-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            status: 'sent' as const,
          }));
          setMessages(loadedMessages);
        }
      } catch (err) {
        console.error('Error loading chat history:', err);
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadHistory();
  }, [websiteId]);

  // Save chat history to database when messages change
  const saveHistory = useCallback(async (messagesToSave: Message[]) => {
    // Skip saving if history hasn't been loaded yet (to avoid overwriting on initial load)
    if (!historyLoaded) return;

    // Filter out messages that are still sending and convert to storage format
    const historyToSave: ChatMessage[] = messagesToSave
      .filter(m => m.status !== 'sending')
      .slice(-MAX_HISTORY_MESSAGES) // Keep only last 10
      .map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));

    try {
      const { error } = await supabase
        .from('websites')
        .update({ chat_history: historyToSave })
        .eq('id', websiteId);

      if (error) {
        console.error('Error saving chat history:', error);
      }
    } catch (err) {
      console.error('Error saving chat history:', err);
    }
  }, [websiteId, historyLoaded]);

  // Save history whenever messages change (debounced effect)
  useEffect(() => {
    if (historyLoaded && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveHistory(messages);
      }, 500); // Debounce saves by 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [messages, historyLoaded, saveHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('website-chat', {
        body: {
          websiteId,
          userId: user.id,
          message: messageText,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get response');
      }

      // Update user message status
      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'sent' } : m
        )
      );

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If jobs were created, notify the parent to show progress
      if (data.jobIds && data.jobIds.length > 0 && onJobCreated) {
        // Notify parent of the first job (they can subscribe to it)
        onJobCreated(data.jobIds[0]);
      }
    } catch (error) {
      console.error('Chat error:', error);

      // Update user message status to error
      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'error' } : m
        )
      );

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split('\n')
      .map((line, i) => {
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Code
        line = line.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 rounded text-sm">$1</code>');
        // Lists
        if (line.startsWith('- ')) {
          return `<li class="ml-4">${line.slice(2)}</li>`;
        }
        return `<p>${line}</p>`;
      })
      .join('');
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50"
      >
        <MessageSquare size={24} />
        {messages.length > 1 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {messages.length - 1}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Website Assistant</h3>
            <p className="text-xs text-white/80">{websiteName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Minimize2 size={16} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm'
              }`}
            >
              <div
                className="text-sm [&_p]:mb-1 [&_li]:mb-0.5 [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
              />
              {message.status === 'sending' && (
                <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                  <Loader2 size={10} className="animate-spin" />
                  Sending...
                </div>
              )}
              {message.status === 'error' && (
                <div className="text-xs mt-1 text-red-300">
                  Failed to send
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions - show if no user messages in conversation */}
      {!messages.some(m => m.role === 'user') && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-full transition-colors"
              >
                <action.icon size={12} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the changes you want..."
            rows={1}
            className="flex-1 px-4 py-2.5 bg-slate-100 border-0 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Powered by Claude AI
        </p>
      </div>
    </div>
  );
};
