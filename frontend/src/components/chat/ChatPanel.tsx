'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Wrench, Cpu, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: any[];
  provider?: string;
  modelUsed?: string;
}

function getModelIcon(provider?: string) {
  switch (provider) {
    case 'cursor-sdk':
      return <Cpu className="w-4 h-4 text-purple-400" />;
    case 'ai-foundry':
      return <Cpu className="w-4 h-4 text-emerald-400" />;
    case 'gemini':
      return <Cpu className="w-4 h-4 text-blue-400" />;
    case 'openai':
      return <Cpu className="w-4 h-4 text-cyan-400" />;
    default:
      return <Bot className="w-4 h-4" />;
  }
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to Metl! I can help you build and deploy applications. What would you like to create?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('');
  const [currentModel, setCurrentModel] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'default-tenant',
          message: input,
          history: messages,
        }),
      });

      const data = await res.json();

      if (data.mode === 'codegen') {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Task created: ${data.taskId}. I'll process your request.`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.content,
            provider: data.provider,
            modelUsed: data.modelUsed,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, there was an error processing your request.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const streamMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
      },
    ]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'default-tenant',
          message: input,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (!reader) throw new Error('No reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content: fullContent,
                          provider: data.provider,
                          modelUsed: data.modelUsed,
                        }
                      : msg
                  )
                );
              } else if (data.type === 'done') {
                setCurrentProvider(data.provider);
                setCurrentModel(data.modelUsed);
              } else if (data.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: `Error: ${data.message}` }
                      : msg
                  )
                );
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: 'Sorry, there was an error streaming your request.' }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove the last assistant message if present
    const lastAssistantIdx = messages.length - 1;
    if (messages[lastAssistantIdx]?.role === 'assistant') {
      setMessages((prev) => prev.slice(0, -1));
    }

    setInput(lastUserMsg.content);
    await streamMessage();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xl font-bold">Metl Assistant</h2>
        <p className="text-sm text-slate-400">Chat with the AI to build and manage your apps</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                {msg.role === 'tool' ? <Wrench className="w-4 h-4" /> : getModelIcon(msg.provider)}
              </div>
            )}
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.role === 'tool'
                  ? 'bg-amber-600/20 text-amber-200 border border-amber-600/30'
                  : 'bg-slate-800 text-slate-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && msg.provider && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Cpu className="w-3 h-3" />
                  <span>
                    {msg.provider === 'cursor-sdk' ? 'Cursor SDK' : msg.provider === 'ai-foundry' ? 'AI Foundry' : msg.provider}
                    {msg.modelUsed ? ` / ${msg.modelUsed}` : ''}
                  </span>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        {loading && !messages[messages.length - 1]?.content && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-slate-800 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {currentProvider && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Using {currentProvider} / {currentModel}
                </p>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? sendMessage() : streamMessage();
              }
            }}
            placeholder="Ask me to build something... (Shift+Enter for non-streaming)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            aria-label="Send message"
            title="Send message (non-streaming)"
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={streamMessage}
            disabled={loading}
            aria-label="Stream message"
            title="Stream message (live response)"
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 transition-colors"
          >
            <Cpu className="w-4 h-4" />
          </button>
          <button
            onClick={regenerate}
            disabled={loading}
            aria-label="Regenerate"
            title="Regenerate last response"
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
