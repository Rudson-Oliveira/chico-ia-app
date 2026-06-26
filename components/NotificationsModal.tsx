import React from 'react';
import { SystemNotification } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, notifications }) => {
  if (!isOpen) return null;

  // Helper to get YouTube ID from URL
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2] && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)] border border-[var(--border-color)] max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-2xl font-bold">Avisos do Sistema</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-3xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {(!notifications || notifications.length === 0) ? (
            <p className="text-center text-[var(--text-secondary)] py-8">Nenhuma notificação nova.</p>
          ) : (
            notifications.map(notif => {
              const youtubeId = notif.videoUrl ? getYouTubeId(notif.videoUrl) : null;
              
              return (
                <div key={notif.id} className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">{notif.title}</h3>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {notif.createdAt.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] whitespace-pre-wrap mb-4">{notif.message}</p>
                    
                    {/* Action Button for Link */}
                    {notif.linkUrl && (
                      <a 
                        href={notif.linkUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] font-bold rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors shadow-sm mb-2"
                      >
                        {notif.linkText || 'Clique Aqui'}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  
                  {youtubeId && (
                    <div className="relative pt-[56.25%] w-full bg-black">
                      <iframe 
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}
                  {notif.videoUrl && !youtubeId && (
                    <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-color)]">
                      <a href={notif.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline flex items-center text-sm font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Assistir Vídeo Externo
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
