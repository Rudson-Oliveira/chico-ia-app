
import React, { useState, useEffect } from 'react';
import { 
    getFocoFlowData, 
    deleteFocoFlowItem, 
    deleteFocoFlowTransaction,
    deleteFocoFlowAccount,
    deleteFocoFlowRecurring,
    deleteFocoFlowThirdParty,
    updateFocoFlowItem,
    updateFocoFlowTransaction,
    getFinancialSummary,
    getMonthlyFinancialReport,
    createFocoFlowTransaction,
    createFocoFlowAccount,
    createFocoFlowRecurring,
    createFocoFlowThirdParty,
    createFocoFlowTask,
    createFocoFlowLink,
    createFocoFlowReminder
} from '../services/focoFlowService';
import FinancialReportCard from './FinancialReportCard';

interface FocoFlowDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const FocoFlowDashboard: React.FC<FocoFlowDashboardProps> = ({ isOpen, onClose, userId }) => {
    const [activeTab, setActiveTab] = useState<'finances' | 'tasks' | 'links' | 'reminders'>('tasks');
    const [financeSubTab, setFinanceSubTab] = useState<'painel' | 'movimentacoes' | 'recorrentes' | 'contas' | 'terceiros' | 'relatorios'>('painel');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<any>(null);
    const [financialSummary, setFinancialSummary] = useState<any>(null);
    const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [newItemType, setNewItemType] = useState<'transaction' | 'account' | 'recurring' | 'thirdParty' | 'task' | 'link' | 'reminder'>('transaction');
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, activeTab, financeSubTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'finances') {
                if (financeSubTab === 'painel') {
                    const summary = await getFinancialSummary(userId);
                    setFinancialSummary(summary);
                    setData([]);
                } else if (financeSubTab === 'movimentacoes') {
                    const transactions = await getFocoFlowData(userId, 'focuflow_financial_transactions', 50);
                    setData(transactions);
                } else if (financeSubTab === 'contas') {
                    const accounts = await getFocoFlowData(userId, 'focuflow_accounts', 50);
                    setData(accounts);
                } else if (financeSubTab === 'recorrentes') {
                    const recurring = await getFocoFlowData(userId, 'focuflow_recurring', 50);
                    setData(recurring);
                } else if (financeSubTab === 'terceiros') {
                    const thirdParties = await getFocoFlowData(userId, 'focuflow_third_parties', 50);
                    setData(thirdParties);
                } else if (financeSubTab === 'relatorios') {
                    const reportData = await getMonthlyFinancialReport(userId);
                    setReport(reportData);
                    setData([]);
                }
            } else {
                const category = activeTab === 'tasks' ? 'task' : activeTab === 'links' ? 'link' : 'reminder';
                const items = await getFocoFlowData(userId, 'focuflow_items', 50, category);
                setData(items);
            }
        } catch (error) {
            console.error("Error fetching FocoFlow data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        
        try {
            if (activeTab === 'finances') {
                if (financeSubTab === 'movimentacoes') {
                    await deleteFocoFlowTransaction(itemToDelete);
                } else if (financeSubTab === 'contas') {
                    await deleteFocoFlowAccount(itemToDelete);
                } else if (financeSubTab === 'recorrentes') {
                    await deleteFocoFlowRecurring(itemToDelete);
                } else if (financeSubTab === 'terceiros') {
                    await deleteFocoFlowThirdParty(itemToDelete);
                }
            } else {
                await deleteFocoFlowItem(itemToDelete);
            }
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
            fetchData();
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    const toggleTaskStatus = async (item: any) => {
        if (activeTab !== 'tasks') return;
        const newStatus = item.status === 'done' ? 'todo' : 'done';
        try {
            await updateFocoFlowItem(item.id, { status: newStatus });
            fetchData();
        } catch (error) {
            console.error("Error updating task status:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-2xl overflow-hidden w-full max-w-6xl h-[90vh] flex flex-col border border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]/50">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-[var(--accent-primary)]/20 rounded-2xl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Painel Visual FocoFlow</h2>
                            <p className="text-[var(--text-secondary)] text-sm">Gerencie suas tarefas, finanças e links em um só lugar.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Main Tabs */}
                <div className="flex p-2 bg-[var(--bg-primary)]/30 border-b border-[var(--border-color)] overflow-x-auto">
                    {[
                        { id: 'tasks', label: 'Tarefas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                        { id: 'finances', label: 'Financeiro', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { id: 'links', label: 'Links', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
                        { id: 'reminders', label: 'Lembretes', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-text)] shadow-lg scale-105' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                            </svg>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Finance Sub-Tabs */}
                {activeTab === 'finances' && (
                    <div className="flex p-2 bg-[var(--bg-primary)]/20 border-b border-[var(--border-color)] overflow-x-auto">
                        {[
                            { id: 'painel', label: 'Painel', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
                            { id: 'movimentacoes', label: 'Movimentações', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                            { id: 'recorrentes', label: 'Recorrentes', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
                            { id: 'contas', label: 'Contas', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                            { id: 'terceiros', label: 'Terceiros', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                            { id: 'relatorios', label: 'Relatórios', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
                        ].map(subTab => (
                            <button
                                key={subTab.id}
                                onClick={() => setFinanceSubTab(subTab.id as any)}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap text-sm ${financeSubTab === subTab.id ? 'bg-[#0d9488] text-white shadow-md' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={subTab.icon} />
                                </svg>
                                <span>{subTab.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[var(--accent-primary)]"></div>
                            <p className="mt-4 text-[var(--text-secondary)] font-medium">Carregando seus dados...</p>
                        </div>
                    ) : (
                        <div className="w-full">
                            {activeTab === 'finances' && financeSubTab === 'painel' && financialSummary && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Saldo Real */}
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
                                            <div className="flex items-center space-x-2 text-[#10b981] mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-bold uppercase tracking-wider">Saldo Real</span>
                                            </div>
                                            <div className="text-3xl font-black text-[#10b981]">
                                                R$ {financialSummary.realBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        {/* Entradas */}
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
                                            <div className="flex items-center space-x-2 text-[#10b981] mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" />
                                                </svg>
                                                <span className="text-sm font-bold uppercase tracking-wider">Entradas</span>
                                            </div>
                                            <div className="text-3xl font-black text-[#10b981]">
                                                R$ {financialSummary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        {/* Gastos */}
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
                                            <div className="flex items-center space-x-2 text-[#ef4444] mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                                                </svg>
                                                <span className="text-sm font-bold uppercase tracking-wider">Gastos</span>
                                            </div>
                                            <div className="text-3xl font-black text-[#ef4444]">
                                                R$ {financialSummary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        {/* A Receber */}
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
                                            <div className="flex items-center space-x-2 text-[#3b82f6] mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                                <span className="text-sm font-bold uppercase tracking-wider">A Receber</span>
                                            </div>
                                            <div className="text-3xl font-black text-[#3b82f6]">
                                                R$ {financialSummary.toReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        {/* Terceiros */}
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
                                            <div className="flex items-center space-x-2 text-[#f59e0b] mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                                <span className="text-sm font-bold uppercase tracking-wider">Terceiros</span>
                                            </div>
                                            <div className="text-3xl font-black text-[#f59e0b]">
                                                R$ {financialSummary.thirdPartiesBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        {/* A Pagar */}
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
                                            <div className="flex items-center space-x-2 text-[#ef4444] mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-bold uppercase tracking-wider">A Pagar</span>
                                            </div>
                                            <div className="text-3xl font-black text-[#ef4444]">
                                                R$ {financialSummary.toPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            setNewItemType('transaction');
                                            setFormData({ type: 'expense', date: new Date().toISOString().split('T')[0] });
                                            setIsNewItemModalOpen(true);
                                        }}
                                        className="w-full py-4 bg-[#0d9488] hover:bg-[#0f766e] text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 text-lg"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span>Nova Movimentação</span>
                                    </button>
                                </div>
                            )}

                            {activeTab === 'finances' && financeSubTab === 'relatorios' && report && (
                                <div className="col-span-full mb-6">
                                    <FinancialReportCard data={report} />
                                </div>
                            )}

                            {(activeTab !== 'finances' || (financeSubTab !== 'painel' && financeSubTab !== 'relatorios')) && (
                                <div className="space-y-6">
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={() => {
                                                const typeMap: any = {
                                                    'tasks': 'task',
                                                    'links': 'link',
                                                    'reminders': 'reminder',
                                                    'movimentacoes': 'transaction',
                                                    'contas': 'account',
                                                    'recorrentes': 'recurring',
                                                    'terceiros': 'thirdParty'
                                                };
                                                const type = activeTab === 'finances' ? typeMap[financeSubTab] : typeMap[activeTab];
                                                setNewItemType(type);
                                                setFormData({});
                                                setIsNewItemModalOpen(true);
                                            }}
                                            className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] font-bold rounded-xl shadow-md hover:opacity-90 transition-all flex items-center space-x-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                            </svg>
                                            <span>Adicionar {
                                                activeTab === 'tasks' ? 'Tarefa' :
                                                activeTab === 'links' ? 'Link' :
                                                activeTab === 'reminders' ? 'Lembrete' :
                                                financeSubTab === 'movimentacoes' ? 'Movimentação' :
                                                financeSubTab === 'contas' ? 'Conta' :
                                                financeSubTab === 'recorrentes' ? 'Recorrência' : 'Terceiro'
                                            }</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {data.length === 0 ? (
                                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                            <p className="text-xl font-medium">Nenhum item encontrado nesta categoria.</p>
                                            <p className="text-sm">Peça ao Chico para salvar algo para você!</p>
                                        </div>
                                    ) : (
                                        data.map((item) => (
                                            <div key={item.id} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                                {/* Background Decoration */}
                                                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-500 ${
                                                    activeTab === 'tasks' ? 'bg-blue-500' : 
                                                    activeTab === 'finances' ? (
                                                        financeSubTab === 'movimentacoes' ? (item.type === 'income' ? 'bg-green-500' : 'bg-red-500') :
                                                        financeSubTab === 'contas' ? 'bg-emerald-500' :
                                                        financeSubTab === 'recorrentes' ? 'bg-indigo-500' :
                                                        financeSubTab === 'terceiros' ? 'bg-amber-500' : 'bg-gray-500'
                                                    ) : 
                                                    activeTab === 'links' ? 'bg-purple-500' : 'bg-yellow-500'
                                                }`}></div>

                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center space-x-2">
                                                            {activeTab === 'tasks' && (
                                                                <button 
                                                                    onClick={() => toggleTaskStatus(item)}
                                                                    className={`p-1.5 rounded-lg transition-colors ${item.status === 'done' ? 'bg-green-500/20 text-green-500' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-blue-500/20 hover:text-blue-500'}`}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                                activeTab === 'tasks' ? (item.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500') :
                                                                activeTab === 'finances' ? (
                                                                    financeSubTab === 'movimentacoes' ? (item.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500') :
                                                                    financeSubTab === 'contas' ? 'bg-emerald-500/10 text-emerald-500' :
                                                                    financeSubTab === 'recorrentes' ? 'bg-indigo-500/10 text-indigo-500' :
                                                                    financeSubTab === 'terceiros' ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-500/10 text-gray-500'
                                                                ) :
                                                                activeTab === 'links' ? 'bg-purple-500/10 text-purple-500' : 'bg-yellow-500/10 text-yellow-500'
                                                            }`}>
                                                                {activeTab === 'tasks' ? (item.status === 'done' ? 'Concluída' : 'Pendente') :
                                                                 activeTab === 'finances' ? (
                                                                    financeSubTab === 'movimentacoes' ? (item.type === 'income' ? 'Receita' : 'Despesa') :
                                                                    financeSubTab === 'contas' ? 'Conta' :
                                                                    financeSubTab === 'recorrentes' ? 'Recorrência' :
                                                                    financeSubTab === 'terceiros' ? 'Terceiro' : 'Financeiro'
                                                                 ) :
                                                                 activeTab === 'links' ? 'Link' : 'Lembrete'}
                                                            </span>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    <h4 className={`text-lg font-bold text-[var(--text-primary)] mb-1 ${item.status === 'done' ? 'line-through opacity-50' : ''}`}>
                                                        {item.title || item.description || item.name || 'Sem título'}
                                                    </h4>

                                                    {item.amount && (
                                                        <div className={`text-2xl font-black mb-2 ${item.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                                                            {item.type === 'income' ? '+' : '-'} R$ {Number(item.amount).toFixed(2)}
                                                        </div>
                                                    )}

                                                    {item.balance !== undefined && (
                                                        <div className={`text-2xl font-black mb-2 ${item.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            R$ {Number(item.balance).toFixed(2)}
                                                        </div>
                                                    )}

                                                    {item.description && activeTab !== 'finances' && (
                                                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">{item.description}</p>
                                                    )}

                                                    {item.url && (
                                                        <a 
                                                            href={item.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="mt-2 inline-flex items-center text-blue-400 hover:text-blue-300 text-sm font-bold group/link"
                                                        >
                                                            <span>Visitar Link</span>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </a>
                                                    )}

                                                    <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-medium">
                                                        <div className="flex items-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            {item.createdAt && typeof item.createdAt.toDate === 'function' 
                                                                ? item.createdAt.toDate().toLocaleDateString() 
                                                                : item.date && typeof item.date.toDate === 'function'
                                                                ? item.date.toDate().toLocaleDateString()
                                                                : 'Recentemente'}
                                                        </div>
                                                        {item.priority && (
                                                            <span className={`px-2 py-0.5 rounded uppercase ${
                                                                item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                                                item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-green-500/20 text-green-400'
                                                            }`}>
                                                                {item.priority}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-[var(--bg-primary)]/50 border-t border-[var(--border-color)] flex justify-center">
                    <p className="text-[var(--text-secondary)] text-xs font-medium">FocoFlow v2.0 • Organização Inteligente</p>
                </div>
            </div>

            {/* New Item Modal */}
            {isNewItemModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsNewItemModalOpen(false)}>
                    <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]/50">
                            <h3 className="text-xl font-black text-[var(--text-primary)]">
                                {newItemType === 'transaction' ? 'Nova Movimentação' :
                                 newItemType === 'account' ? 'Nova Conta' :
                                 newItemType === 'recurring' ? 'Nova Recorrência' :
                                 newItemType === 'thirdParty' ? 'Novo Terceiro' :
                                 newItemType === 'task' ? 'Nova Tarefa' :
                                 newItemType === 'link' ? 'Novo Link' : 'Novo Lembrete'}
                            </h3>
                            <button onClick={() => setIsNewItemModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form className="p-6 space-y-4" onSubmit={async (e) => {
                            e.preventDefault();
                            setLoading(true);
                            try {
                                if (newItemType === 'transaction') {
                                    await createFocoFlowTransaction(userId, formData);
                                } else if (newItemType === 'account') {
                                    await createFocoFlowAccount(userId, formData);
                                } else if (newItemType === 'recurring') {
                                    await createFocoFlowRecurring(userId, formData);
                                } else if (newItemType === 'thirdParty') {
                                    await createFocoFlowThirdParty(userId, formData);
                                } else if (newItemType === 'task') {
                                    await createFocoFlowTask(userId, { ...formData, category: 'task' });
                                } else if (newItemType === 'link') {
                                    await createFocoFlowLink(userId, formData);
                                } else if (newItemType === 'reminder') {
                                    await createFocoFlowReminder(userId, formData);
                                }
                                setIsNewItemModalOpen(false);
                                fetchData();
                            } catch (error) {
                                console.error("Error creating item:", error);
                            } finally {
                                setLoading(false);
                            }
                        }}>
                            {newItemType === 'transaction' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Descrição</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Valor</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                required
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                                value={formData.amount || ''}
                                                onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Tipo</label>
                                            <select 
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                                value={formData.type || 'expense'}
                                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                                            >
                                                <option value="income">Receita</option>
                                                <option value="expense">Despesa</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Data</label>
                                        <input 
                                            type="date" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.date || ''}
                                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                                        />
                                    </div>
                                </>
                            )}

                            {newItemType === 'account' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Nome da Conta</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Saldo Inicial</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.balance || ''}
                                            onChange={(e) => setFormData({...formData, balance: Number(e.target.value)})}
                                        />
                                    </div>
                                </>
                            )}

                            {newItemType === 'thirdParty' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Nome</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Saldo Devedor/Credor</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.balance || ''}
                                            onChange={(e) => setFormData({...formData, balance: Number(e.target.value)})}
                                        />
                                    </div>
                                </>
                            )}

                            {newItemType === 'recurring' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Descrição</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Valor</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                required
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                                value={formData.amount || ''}
                                                onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Frequência</label>
                                            <select 
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                                value={formData.frequency || 'monthly'}
                                                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                                            >
                                                <option value="weekly">Semanal</option>
                                                <option value="monthly">Mensal</option>
                                                <option value="yearly">Anual</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {newItemType === 'task' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Título da Tarefa</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.title || ''}
                                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Prioridade</label>
                                        <select 
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.priority || 'medium'}
                                            onChange={(e) => setFormData({...formData, priority: e.target.value})}
                                        >
                                            <option value="low">Baixa</option>
                                            <option value="medium">Média</option>
                                            <option value="high">Alta</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {newItemType === 'link' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Título</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.title || ''}
                                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">URL</label>
                                        <input 
                                            type="url" 
                                            required
                                            placeholder="https://..."
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.url || ''}
                                            onChange={(e) => setFormData({...formData, url: e.target.value})}
                                        />
                                    </div>
                                </>
                            )}

                            {newItemType === 'reminder' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">O que lembrar?</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.title || ''}
                                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Data/Hora</label>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                            value={formData.dueDate || ''}
                                            onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                                        />
                                    </div>
                                </>
                            )}

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] font-black rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {loading ? 'Salvando...' : 'Salvar Item'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}>
                    <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Confirmar Exclusão</h3>
                            <p className="text-[var(--text-secondary)] mb-6">Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.</p>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold rounded-xl hover:bg-[var(--border-color)] transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocoFlowDashboard;

