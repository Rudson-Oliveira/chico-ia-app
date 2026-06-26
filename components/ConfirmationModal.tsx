import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden p-8 text-[var(--text-primary)] border border-[var(--border-color)] max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-[var(--text-secondary)] mb-6">{message}</p>
        <div className="flex justify-end space-x-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-[var(--destructive-color)] text-white hover:opacity-90 transition-opacity">Confirmar Exclusão</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
