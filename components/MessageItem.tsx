import React from 'react';
import { ConversationMessage } from '../types';
import FocoFlowItemRenderer from './FocoFlowItemRenderer';
import CopyableContentBlock from './CopyableContentBlock';
import MessageActions from './MessageActions';

interface MessageItemProps {
  msg: ConversationMessage;
}

// Uma bolha de mensagem do chat. Extraido do App.tsx (que era um monolito de
// ~3100 linhas). Memoizado: como o App re-renderiza a cada frame de transcricao
// ao vivo, sem o memo TODAS as mensagens re-renderizavam a cada update. Com
// React.memo so re-renderiza quando o proprio `msg` muda.
const MessageItem: React.FC<MessageItemProps> = ({ msg }) => {
  return (
    <div className={`chat-msg-row flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative group ${
        msg.role === 'user'
          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded-tr-none'
          : msg.role === 'system'
            ? 'bg-[var(--bg-tertiary)] border border-[var(--destructive-color)]/30 text-[var(--text-primary)] w-full text-center text-sm py-2'
            : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-none'
      }`}>
        {msg.role !== 'system' && (
          <div className={`absolute top-2 ${msg.role === 'user' ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <MessageActions messageText={msg.text} messageId={msg.id} />
          </div>
        )}

        {msg.imageUrl && (
          <div className="mb-3 rounded-lg overflow-hidden border border-black/10">
            <img src={msg.imageUrl} alt={msg.fileName || 'Imagem enviada'} className="max-w-full h-auto" />
          </div>
        )}

        {/* Render text based on blockType */}
        {msg.blockType === 'code' || msg.blockType === 'text' || msg.blockType === 'prompt' ? (
          <CopyableContentBlock content={msg.text} blockType={msg.blockType} />
        ) : (
          <div className="space-y-2">
            {(msg.text || '').split(/(\[\[FOCOFLOW_ITEM:.*?\]\])/g).map((part, index) => {
              const match = part.match(/\[\[FOCOFLOW_ITEM:(.*?)\]\]/);
              if (match && match[1]) {
                try {
                  const data = JSON.parse(match[1]);
                  return <FocoFlowItemRenderer key={index} data={data} />;
                } catch (e) {
                  console.error('Failed to parse FocoFlow item JSON:', e);
                  return <p key={index} className="whitespace-pre-wrap leading-relaxed">{part}</p>;
                }
              }
              return part ? <p key={index} className="whitespace-pre-wrap leading-relaxed">{part}</p> : null;
            })}
          </div>
        )}

        {msg.role !== 'system' && (
          <p className={`text-[10px] mt-2 text-right ${msg.role === 'user' ? 'text-black/40' : 'text-gray-500'}`}>
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessageItem);
