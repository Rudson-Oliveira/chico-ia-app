import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { agentService, AgentTask, AgentStep } from '../services/agentService';

const AgentPanel: React.FC = () => {
  const [goal, setGoal] = useState('');
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);

  useEffect(() => {
    setTasks(agentService.getTasks());
    agentService.onUpdate((updatedTask) => {
      setTasks(agentService.getTasks());
      if (activeTask?.id === updatedTask.id) {
        setActiveTask({ ...updatedTask });
      }
    });
  }, [activeTask?.id]);

  const handleRunAgent = async () => {
    if (!goal.trim()) return;
    const task = await agentService.run(goal);
    setActiveTask(task);
    setGoal('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'executing': return 'bg-blue-500';
      case 'planning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">🤖</span> Agente Autônomo Chico
        </h1>
        <p className="text-gray-600 mt-2">Dê um objetivo e eu farei o resto: planejar, agir, observar e refletir.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
        {/* Input & Active Task */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Qual seu objetivo hoje?</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ex: Pesquise o preço do dólar e salve num arquivo..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleRunAgent()}
              />
              <button 
                onClick={handleRunAgent}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
              >
                Executar
              </button>
            </div>
          </div>

          {activeTask ? (
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-800 truncate pr-4">Tarefa Ativa: {activeTask.goal}</h2>
                <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getStatusColor(activeTask.status)}`}>
                  {activeTask.status.toUpperCase()}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeTask.steps.map((step, idx) => (
                  <motion.div 
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`relative pl-8 border-l-2 ${step.status === 'done' ? 'border-green-500' : step.status === 'running' ? 'border-blue-500' : 'border-gray-200'}`}
                  >
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${step.status === 'done' ? 'bg-green-500' : step.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'}`} />
                    
                    <div className="mb-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{step.tool}</span>
                      <h3 className="font-semibold text-gray-800">{step.description}</h3>
                    </div>
                    
                    {step.output && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 font-mono border border-gray-100">
                        {step.output}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {activeTask.result && (
                <div className="p-6 bg-green-50 border-t border-green-100">
                  <h3 className="font-bold text-green-800 mb-1">Resultado Final:</h3>
                  <p className="text-green-700">{activeTask.result}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-100">
              <span className="text-6xl mb-4">🎯</span>
              <p>Nenhuma tarefa ativa no momento.</p>
            </div>
          )}
        </div>

        {/* History Sidebar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-50 font-bold text-gray-800">Histórico de Tarefas</div>
          <div className="flex-1 overflow-y-auto">
            {tasks.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {tasks.map(task => (
                  <button 
                    key={task.id}
                    onClick={() => setActiveTask(task)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${activeTask?.id === task.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(task.status)}`} />
                      <span className="text-[10px] font-bold text-gray-400">{new Date(task.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 line-clamp-2">{task.goal}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                Histórico vazio.
              </div>
            )}
          </div>
          <button 
            onClick={() => agentService.clearCompleted()}
            className="p-4 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors border-t border-gray-50 uppercase tracking-widest"
          >
            Limpar Concluídas
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
