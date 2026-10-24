import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Sparkles, Hash, Trophy, DollarSign } from 'lucide-react';
import { ChatMessage } from '../types/bingo.ts';

interface LiveChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<boolean>;
  currentUser: { id: string; name: string };
}

export const LiveChat: React.FC<LiveChatProps> = ({
  messages,
  onSendMessage,
  currentUser,
}) => {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    const ok = await onSendMessage(inputText.trim());
    setSending(false);
    if (ok) {
      setInputText('');
    }
  };

  const handleSendEmoji = (emoji: string) => {
    onSendMessage(emoji);
  };

  const quickEmojis = ['🎉', '🍀', '💰', '🎱', '🤞', '🔥', '👏', '🤑'];

  return (
    <div className="flex flex-col h-[400px] sm:h-[480px] rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Chat Ao Vivo dos Jogadores
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Em tempo real</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className={`p-2 rounded-xl text-xs flex items-start gap-2 border ${
                  msg.systemType === 'winner'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                    : msg.systemType === 'pix'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                    : msg.systemType === 'ball'
                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
                }`}
              >
                <span className="text-base leading-none shrink-0 mt-0.5">
                  {msg.senderAvatar}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-extrabold uppercase text-[10px] tracking-wider block opacity-75">
                    {msg.senderName}
                  </span>
                  <p className="text-xs break-words font-medium">{msg.text}</p>
                </div>
              </div>
            );
          }

          const isMe = msg.senderId === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 text-xs ${
                isMe ? 'flex-row-reverse' : ''
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-sm shadow-sm">
                {msg.senderAvatar}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm ${
                  isMe
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'
                }`}
              >
                {!isMe && (
                  <span className="text-[10px] font-bold text-amber-400 block mb-0.5">
                    {msg.senderName}
                  </span>
                )}
                <p className="break-words leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Emojis */}
      <div className="px-3 py-1.5 bg-slate-950/40 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
          Reações:
        </span>
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSendEmoji(emoji)}
            className="text-sm p-1 rounded-lg hover:bg-slate-800 active:scale-125 transition-transform cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Mande uma mensagem no chat..."
          maxLength={140}
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
        >
          <Send className="w-4 h-4 stroke-[2.5]" />
        </button>
      </form>
    </div>
  );
};
