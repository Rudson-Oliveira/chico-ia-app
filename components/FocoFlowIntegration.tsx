import React from 'react';

interface FocoFlowIntegrationProps {
    isOpen: boolean;
    onClose: () => void;
}

const FocoFlowIntegration: React.FC<FocoFlowIntegrationProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden p-8 border border-[var(--border-color)] max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Integração FocoFlow</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-3xl leading-none">&times;</button>
                </div>

                <div className="text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h3 className="text-xl font-bold text-green-500 mb-2">Conexão Ativa</h3>
                    <p className="text-[var(--text-secondary)] mb-6">
                        O Chico e o FocoFlow compartilham a mesma conta. 
                        Tudo o que você salvar aqui será refletido automaticamente no seu painel do FocoFlow.
                    </p>
                    
                    <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-color)] text-left space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-[var(--text-primary)]">Sincronização de Tarefas</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-[var(--text-primary)]">Gestão Financeira Compartilhada</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-[var(--text-primary)]">Lembretes e Links em Tempo Real</span>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-full mt-6 py-3 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] font-bold rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FocoFlowIntegration;
