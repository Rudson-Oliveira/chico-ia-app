import React, { useState } from 'react';
import { CustomAgent } from '../types';
import { SYSTEM_AGENTS } from '../constants';

type Agent = string;

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (agent: Agent) => void;
  onDeactivate: () => void;
  activeAgent: Agent;
  customAgents: CustomAgent[];
  onCreateAgent: (name: string, description: string, instruction: string) => void;
  onUpdateAgent: (id: string, name: string, description: string, instruction: string) => void;
  onDeleteAgent: (id: string) => void;
}

const AgentsModal: React.FC<AgentsModalProps> = ({ 
  isOpen, 
  onClose, 
  onActivate, 
  onDeactivate, 
  activeAgent, 
  customAgents, 
  onCreateAgent, 
  onUpdateAgent, 
  onDeleteAgent
}) => {
  if (!isOpen) return null;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setInstruction('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (agent: CustomAgent) => {
    setEditingId(agent.id);
    setName(agent.name);
    setDescription(agent.description);
    setInstruction(agent.systemInstruction);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && description && instruction) {
      if (editingId) {
        onUpdateAgent(editingId, name, description, instruction);
      } else {
        onCreateAgent(name, description, instruction);
      }
      setIsFormOpen(false);
      setEditingId(null);
      setName('');
      setDescription('');
      setInstruction('');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)] border border-[var(--border-color)] max-w-5xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)] flex-shrink-0">
          <h2 className="text-2xl font-bold">Agentes Especialistas</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-3xl leading-none">&times;</button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1">
          {isFormOpen ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center mb-6">
                <button onClick={() => setIsFormOpen(false)} className="mr-4 text-[var(--accent-primary)] hover:underline">← Voltar</button>
                <h3 className="text-xl font-bold">{editingId ? 'Editar Agente' : 'Criar Novo Agente'}</h3>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nome do Agente</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ex: Contador Especialista"
                    className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Descrição Curta</label>
                  <input 
                    type="text" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Ex: Ajuda com impostos e contabilidade."
                    className="w-full p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Persona / Instruções</label>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Descreva detalhadamente quem é este agente, o que ele sabe e como ele deve se comportar.</p>
                  <textarea 
                    value={instruction} 
                    onChange={e => setInstruction(e.target.value)} 
                    placeholder="Ex: Você é um contador sênior com 20 anos de experiência em legislação tributária brasileira. Seu tone é formal e preciso. Você deve..."
                    className="w-full p-3 h-40 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    required 
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] font-bold rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors">
                  {editingId ? 'Salvar Alterações' : 'Salvar Agente'}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-[var(--text-secondary)]">Agentes do Sistema</h3>
                <button onClick={handleOpenCreate} className="flex items-center space-x-2 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-text)] rounded-lg transition-colors border border-[var(--border-color)] text-sm font-bold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  <span>Criar Agente Personalizado</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {SYSTEM_AGENTS.map(agent => (
                  <div key={agent.id} className={`p-6 rounded-lg border-2 transition-all flex flex-col ${activeAgent === agent.id ? 'border-[var(--accent-primary)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-color)] bg-[var(--bg-primary)]'}`}>
                    <div className="flex items-center space-x-3 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeAgent === agent.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={agent.icon} /></svg>
                      <h3 className="text-lg font-bold">{agent.name}</h3>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-4 h-24 flex-grow overflow-hidden">{agent.description}</p>
                    <button
                      onClick={() => agent.id === 'default' ? onDeactivate() : onActivate(agent.id as Agent)}
                      disabled={activeAgent === agent.id}
                      className="w-full mt-auto py-2 px-4 rounded-md text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-secondary)]"
                    >
                      {activeAgent === agent.id ? 'Ativo' : 'Ativar'}
                    </button>
                  </div>
                ))}
              </div>

              {customAgents && customAgents.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-6 border-t border-[var(--border-color)] pt-6">Meus Agentes Personalizados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {customAgents.map(agent => (
                      <div key={agent.id} className={`p-6 rounded-lg border-2 transition-all flex flex-col relative group ${activeAgent === agent.id ? 'border-[var(--accent-primary)] bg-[var(--bg-tertiary)]' : 'border-[var(--border-color)] bg-[var(--bg-primary)]'}`}>
                        <div className="absolute top-2 right-2 flex space-x-1 z-10">
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(agent); }} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] bg-[var(--bg-primary)]/80 rounded-full shadow-sm border border-[var(--border-color)] backdrop-blur-sm transition-colors" title="Editar Agente">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent.id); }} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--destructive-color)] bg-[var(--bg-primary)]/80 rounded-full shadow-sm border border-[var(--border-color)] backdrop-blur-sm transition-colors" title="Excluir Agente">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="flex items-center space-x-3 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeAgent === agent.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <h3 className="text-lg font-bold truncate">{agent.name}</h3>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-4 h-24 flex-grow overflow-hidden">{agent.description}</p>
                        <button
                          onClick={() => onActivate(agent.id as Agent)}
                          disabled={activeAgent === agent.id}
                          className="w-full mt-auto py-2 px-4 rounded-md text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-secondary)]"
                        >
                          {activeAgent === agent.id ? 'Ativo' : 'Ativar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentsModal;
