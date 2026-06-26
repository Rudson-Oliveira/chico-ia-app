import React from 'react';
import { Conversation } from '../types';

interface ArchivedConversationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedConversations: Conversation[];
  onRestoreConversation: (id: string) => Promise<void>;
}

const ArchivedConversationsModal: React.FC<ArchivedConversationsModalProps> = ({ 
  isOpen, 
  onClose, 
  archivedConversations, 
  onRestoreConversation 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)] border border-[var(--border-color)] max-w-xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-2xl font-bold">Conversas Arquivadas</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-3xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {(!archivedConversations || archivedConversations.length === 0) ? (
            <p className="text-center text-[var(--text-secondary)] py-8">Nenhuma conversa arquivada.</p>
          ) : (
            archivedConversations.map(convo => (
              <div key={convo.id} className="flex justify-between items-center bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border-color)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">{convo.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Arquivado em: {convo.createdAt.toLocaleDateString('pt-BR')}</p>
                </div>
                <button
                  onClick={() => onRestoreConversation(convo.id)}
                  className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] font-semibold rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors"
                >
                  Restaurar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivedConversationsModal;
