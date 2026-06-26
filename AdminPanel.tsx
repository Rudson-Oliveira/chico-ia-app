

import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, updateDoc, doc, increment, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, handleFirestoreError, OperationType } from './firebase';
import ErrorBoundary from './components/ErrorBoundary';
import { UserProfile, SystemNotification, BugReport } from './types';

const ChicoLogo = ({ className = "" }) => (
    <div className={`text-4xl font-extrabold ${className}`}>
        <span className="text-white">Chico</span><span className="text-[#00B7FF]">IA</span>
        <span className="text-xs block font-normal text-gray-400 tracking-widest mt-1">ADMINISTRAÇÃO</span>
    </div>
);

// Helper to safely parse dates from various formats (Timestamp, string, Date, null)
const getSafeDate = (dateValue: any): Date => {
    if (!dateValue) return new Date(); // Fallback to now
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate(); // Firestore Timestamp
    }
    if (dateValue instanceof Date) {
        return dateValue;
    }
    const parsed = new Date(dateValue);
    if (isNaN(parsed.getTime())) {
        return new Date(); // Fallback if parsing fails
    }
    return parsed;
};

// Extend UserProfile locally to include the Firestore Document ID
interface AdminUserProfile extends UserProfile {
    docId: string;
}

const AdminPanel = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'notifications' | 'bugs'>('dashboard');
    
    // Users State
    const [users, setUsers] = useState<AdminUserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, active: 0, totalTokens: 0, onlineNow: 0 }); // Added onlineNow
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Notification State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifMessage, setNotifMessage] = useState('');
    const [notifVideoUrl, setNotifVideoUrl] = useState('');
    const [notifLinkUrl, setNotifLinkUrl] = useState(''); // New State
    const [notifLinkText, setNotifLinkText] = useState(''); // New State
    const [sendingNotif, setSendingNotif] = useState(false);
    const [notificationsHistory, setNotificationsHistory] = useState<SystemNotification[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Bug Reports State
    const [bugReports, setBugReports] = useState<BugReport[]>([]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // UPDATED PASSWORD
        if (password === '0102') {
            setIsAuthenticated(true);
            fetchUsers();
        } else {
            setError('Senha de acesso incorreta.');
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const path = 'users';
            const querySnapshot = await getDocs(collection(db, path));
            const fetchedUsers: AdminUserProfile[] = [];
            let activeCount = 0;
            let tokensCount = 0;
            let onlineCount = 0;
            const now = new Date();

            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                
                // Robustly map data to UserProfile interface
                const userData: AdminUserProfile = {
                    docId: docSnapshot.id, // Store the actual Firestore ID (Email or UID)
                    uid: data.uid,
                    email: data.email || 'No Email',
                    name: data.name || 'Sem Nome',
                    subscriptionStatus: data.subscriptionStatus || 'inactive',
                    createdAt: getSafeDate(data.createdAt),
                    lastSeen: data.lastSeen ? getSafeDate(data.lastSeen) : undefined, // Map lastSeen
                    profilePicUrl: data.profilePicUrl,
                    theme: data.theme,
                    voiceName: data.voiceName,
                    usingOwnKey: data.usingOwnKey, 
                    allowedIP: data.allowedIP,
                    usage: {
                        totalTokens: data.usage?.totalTokens || 0,
                        totalCost: data.usage?.totalCost || 0,
                        remainingTokens: data.usage?.remainingTokens || 0
                    },
                    programmingLevel: data.programmingLevel
                };
                
                fetchedUsers.push(userData);
                if (userData.subscriptionStatus === 'active') activeCount++;
                tokensCount += (userData.usage?.totalTokens || 0);

                // Calculate if online (last seen within 5 minutes)
                if (userData.lastSeen) {
                    const diffMs = now.getTime() - userData.lastSeen.getTime();
                    const diffMins = diffMs / 1000 / 60;
                    if (diffMins < 5) {
                        onlineCount++;
                    }
                }
            });

            // SORTING LOGIC: Online users first, then by Newest registration
            fetchedUsers.sort((a, b) => {
                const aLast = a.lastSeen ? a.lastSeen.getTime() : 0;
                const bLast = b.lastSeen ? b.lastSeen.getTime() : 0;
                const aOnline = (now.getTime() - aLast) < 5 * 60 * 1000;
                const bOnline = (now.getTime() - bLast) < 5 * 60 * 1000;

                // Priority 1: Online Status
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;

                // Priority 2: Creation Date (Newest first)
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            setUsers(fetchedUsers);
            setStats({
                total: fetchedUsers.length,
                active: activeCount,
                totalTokens: tokensCount,
                onlineNow: onlineCount
            });
        } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'users');
            alert("Erro ao buscar dados. Verifique o console para detalhes.");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (docId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await updateDoc(doc(db, 'users', docId), {
                subscriptionStatus: newStatus
            });
            // Update local state
            setUsers(prev => prev.map(u => u.docId === docId ? { ...u, subscriptionStatus: newStatus } : u));
            
            // Recalculate stats locally
            if (newStatus === 'active') {
                setStats(prev => ({ ...prev, active: prev.active + 1 }));
            } else {
                setStats(prev => ({ ...prev, active: prev.active - 1 }));
            }
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${docId}`);
            alert("Erro ao atualizar status.");
        }
    };

    const addTokens = async (docId: string) => {
        const amount = prompt("Quantos tokens adicionar? (ex: 10000)");
        if (!amount || isNaN(Number(amount))) return;
        
        try {
            await updateDoc(doc(db, 'users', docId), {
                'usage.remainingTokens': increment(Number(amount))
            });
            alert("Tokens adicionados. Atualize a lista para ver o saldo.");
            fetchUsers(); 
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${docId}`);
            alert("Erro ao adicionar tokens.");
        }
    };

    const handleDeleteUser = async (docId: string) => {
        if (confirm("Tem certeza que deseja excluir permanentemente este usuário? Esta ação não pode ser desfeita.")) {
            try {
                await deleteDoc(doc(db, 'users', docId));
                setUsers(prev => prev.filter(u => u.docId !== docId));
                alert("Usuário excluído com sucesso.");
            } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `users/${docId}`);
                alert("Erro ao excluir usuário.");
            }
        }
    };

    // Notification Logic
    useEffect(() => {
        if (!isAuthenticated) return;

        const q = query(
            collection(db, 'system_notifications'),
            orderBy('createdAt', 'desc')
        );

        const path = 'system_notifications';
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: SystemNotification[] = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                list.push({
                    id: doc.id,
                    title: d.title,
                    message: d.message,
                    videoUrl: d.videoUrl,
                    linkUrl: d.linkUrl, // Fetch linkUrl
                    linkText: d.linkText, // Fetch linkText
                    createdAt: getSafeDate(d.createdAt),
                    viewCount: d.viewCount || 0
                });
            });
            setNotificationsHistory(list);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, path);
        });

        return () => unsubscribe();
    }, [isAuthenticated]);

    // Bug Reports Logic
    useEffect(() => {
        if (!isAuthenticated) return;

        const q = query(
            collection(db, 'bug_reports'),
            orderBy('createdAt', 'desc')
        );

        const path = 'bug_reports';
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: BugReport[] = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                list.push({
                    id: doc.id,
                    uid: d.uid,
                    userName: d.userName,
                    userEmail: d.userEmail,
                    whatsapp: d.whatsapp,
                    description: d.description,
                    screenshotUrl: d.screenshotUrl,
                    status: d.status,
                    createdAt: getSafeDate(d.createdAt)
                });
            });
            setBugReports(list);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, path);
        });

        return () => unsubscribe();
    }, [isAuthenticated]);

    const sendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!notifTitle || !notifMessage) {
            alert("Título e Mensagem são obrigatórios.");
            return;
        }

        setSendingNotif(true);
        try {
            if (editingId) {
                // Update Existing
                await updateDoc(doc(db, 'system_notifications', editingId), {
                    title: notifTitle,
                    message: notifMessage,
                    videoUrl: notifVideoUrl || null,
                    linkUrl: notifLinkUrl || null,
                    linkText: notifLinkText || null,
                });
                alert("Notificação atualizada com sucesso!");
            } else {
                // Create New
                await addDoc(collection(db, 'system_notifications'), {
                    title: notifTitle,
                    message: notifMessage,
                    videoUrl: notifVideoUrl || null,
                    linkUrl: notifLinkUrl || null,
                    linkText: notifLinkText || null,
                    createdAt: serverTimestamp(),
                    viewCount: 0
                });
                alert("Notificação enviada com sucesso!");
            }
            
            setNotifTitle('');
            setNotifMessage('');
            setNotifVideoUrl('');
            setNotifLinkUrl('');
            setNotifLinkText('');
            setEditingId(null);
        } catch (err) {
            const path = editingId ? `system_notifications/${editingId}` : 'system_notifications';
            handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, path);
            alert("Erro ao processar notificação.");
        } finally {
            setSendingNotif(false);
        }
    };

    const handleDeleteNotification = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta notificação?")) {
            try {
                await deleteDoc(doc(db, 'system_notifications', id));
            } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `system_notifications/${id}`);
                alert("Erro ao excluir.");
            }
        }
    };

    const handleDeleteBugReport = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este relatório?")) {
            try {
                await deleteDoc(doc(db, 'bug_reports', id));
            } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `bug_reports/${id}`);
                alert("Erro ao excluir relatório.");
            }
        }
    };

    const updateBugStatus = async (id: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'bug_reports', id), {
                status: newStatus
            });
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `bug_reports/${id}`);
            alert("Erro ao atualizar status do relatório.");
        }
    };

    const handleEditNotification = (notif: SystemNotification) => {
        setNotifTitle(notif.title);
        setNotifMessage(notif.message);
        setNotifVideoUrl(notif.videoUrl || '');
        setNotifLinkUrl(notif.linkUrl || '');
        setNotifLinkText(notif.linkText || '');
        setEditingId(notif.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setNotifTitle('');
        setNotifMessage('');
        setNotifVideoUrl('');
        setNotifLinkUrl('');
        setNotifLinkText('');
        setEditingId(null);
    };

    const isUserOnline = (user: UserProfile) => {
        if (!user.lastSeen) return false;
        const now = new Date();
        const diffMs = now.getTime() - user.lastSeen.getTime();
        return diffMs < 5 * 60 * 1000; // Active in last 5 minutes
    };

    // Filter logic
    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (user.name || '').toLowerCase().includes(term) ||
                              (user.email || '').toLowerCase().includes(term);
        
        let matchesStatus = true;
        if (filterStatus === 'online') {
            matchesStatus = isUserOnline(user);
        } else if (filterStatus !== 'all') {
            matchesStatus = user.subscriptionStatus === filterStatus;
        }
        
        return matchesSearch && matchesStatus;
    });

    if (!isAuthenticated) {
        return (
            <ErrorBoundary>
                <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4 font-sans">
                    <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-700 text-center">
                        <ChicoLogo className="mb-8" />
                        <h2 className="text-xl font-bold text-white mb-6">Acesso Restrito</h2>
                        {error && <p className="mb-4 text-red-400 bg-red-900/30 p-2 rounded text-sm">{error}</p>}
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Senha de Administrador"
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400"
                                autoFocus
                            />
                            <button 
                                type="submit" 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg"
                            >
                                Entrar no Painel
                            </button>
                        </form>
                    </div>
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-6 overflow-x-hidden">
            <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 pb-6 border-b border-gray-800">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <ChicoLogo />
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Usuários
                    </button>
                    <button 
                        onClick={() => setActiveTab('notifications')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Notificações
                    </button>
                    <button 
                        onClick={() => setActiveTab('bugs')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 ${activeTab === 'bugs' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Relatórios de Erros
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                {activeTab === 'dashboard' ? (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <span className="text-gray-400 text-xs uppercase tracking-widest block mb-1">Total de Usuários</span>
                                <span className="text-4xl font-bold text-white">{stats.total}</span>
                            </div>
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <span className="text-gray-400 text-xs uppercase tracking-widest block mb-1">Assinantes Ativos</span>
                                <span className="text-4xl font-bold text-green-400">{stats.active}</span>
                            </div>
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <span className="text-gray-400 text-xs uppercase tracking-widest block mb-1">Online Agora</span>
                                <span className="text-4xl font-bold text-blue-400">{stats.onlineNow}</span>
                            </div>
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <span className="text-gray-400 text-xs uppercase tracking-widest block mb-1">Tokens Totais</span>
                                <span className="text-4xl font-bold text-purple-400">{stats.totalTokens.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <h3 className="text-lg font-bold text-white mb-6">Distribuição de Assinaturas</h3>
                                <div className="h-64 flex items-center justify-center">
                                    <div className="flex flex-col items-center">
                                        <div className="flex gap-8 mb-4">
                                            <div className="text-center">
                                                <div className="text-3xl font-bold text-green-400">{((stats.active / (stats.total || 1)) * 100).toFixed(1)}%</div>
                                                <div className="text-xs text-gray-500 uppercase">Ativos</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-3xl font-bold text-red-400">{(((stats.total - stats.active) / (stats.total || 1)) * 100).toFixed(1)}%</div>
                                                <div className="text-xs text-gray-500 uppercase">Inativos</div>
                                            </div>
                                        </div>
                                        <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden flex">
                                            <div className="bg-green-500 h-full" style={{ width: `${(stats.active / (stats.total || 1)) * 100}%` }}></div>
                                            <div className="bg-red-500 h-full" style={{ width: `${((stats.total - stats.active) / (stats.total || 1)) * 100}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <h3 className="text-lg font-bold text-white mb-6">Relatórios de Erros</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-gray-900 rounded-lg border border-gray-700">
                                        <span className="text-gray-300">Pendentes</span>
                                        <span className="bg-red-900/40 text-red-400 px-3 py-1 rounded-full text-sm font-bold border border-red-900">
                                            {bugReports.filter(b => b.status === 'pending' || !b.status).length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-900 rounded-lg border border-gray-700">
                                        <span className="text-gray-300">Em Análise</span>
                                        <span className="bg-yellow-900/40 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold border border-yellow-900">
                                            {bugReports.filter(b => b.status === 'in-progress').length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-900 rounded-lg border border-gray-700">
                                        <span className="text-gray-300">Resolvidos</span>
                                        <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-sm font-bold border border-green-900">
                                            {bugReports.filter(b => b.status === 'resolved').length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'users' ? (
                    <>
                        <div className="flex gap-4 text-sm mb-6 flex-wrap">
                            <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 shadow-sm flex-1 md:flex-none">
                                <span className="text-gray-400 block text-xs uppercase tracking-wider">Total de Usuários</span>
                                <span className="text-2xl font-bold text-white">{stats.total}</span>
                            </div>
                            <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 shadow-sm flex-1 md:flex-none">
                                <span className="text-gray-400 block text-xs uppercase tracking-wider">Assinantes Ativos</span>
                                <span className="text-2xl font-bold text-green-400">{stats.active}</span>
                            </div>
                            <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 shadow-sm flex-1 md:flex-none border-green-500/30 bg-green-900/10 cursor-pointer hover:bg-green-900/20 transition-colors" onClick={() => setFilterStatus('online')}>
                                <span className="text-gray-400 block text-xs uppercase tracking-wider">Online Agora</span>
                                <span className="text-2xl font-bold text-green-400 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                                    {stats.onlineNow}
                                </span>
                            </div>
                            <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 shadow-sm hidden md:block">
                                <span className="text-gray-400 block text-xs uppercase tracking-wider">Tokens Consumidos</span>
                                <span className="text-2xl font-bold text-blue-400">{stats.totalTokens.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Controls Bar */}
                        <div className="bg-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg border border-gray-700">
                            <div className="w-full md:w-1/3 relative">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por Nome ou Email..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 placeholder-gray-500"
                                />
                            </div>
                            
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <label className="text-sm text-gray-300 font-medium whitespace-nowrap">Status:</label>
                                <select 
                                    value={filterStatus} 
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                >
                                    <option value="all">Todos</option>
                                    <option value="online">🟢 Online Agora</option>
                                    <option value="active">Ativos</option>
                                    <option value="inactive">Inativos / Vencidos</option>
                                </select>
                                {/* UPDATED REFRESH BUTTON WITH TEXT */}
                                <button onClick={fetchUsers} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-bold" title="Atualizar Lista de Usuários">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Atualizar Dados
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-20">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                <p className="mt-4 text-gray-400">Carregando dados...</p>
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider border-b border-gray-600">
                                                <th className="p-4 font-semibold">Usuário</th>
                                                <th className="p-4 font-semibold">Cadastro</th>
                                                <th className="p-4 font-semibold text-center">Status</th>
                                                <th className="p-4 font-semibold text-center">Fonte da API</th>
                                                <th className="p-4 font-semibold text-right">Saldo de Tokens</th>
                                                <th className="p-4 font-semibold text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700 text-sm">
                                            {filteredUsers.map((user) => (
                                                <tr key={user.uid} className={`hover:bg-gray-700/50 transition-colors ${isUserOnline(user) ? 'bg-green-900/10' : ''}`}>
                                                    <td className="p-4">
                                                        <div className="flex flex-col relative">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-white text-base">{user.name}</span>
                                                                {isUserOnline(user) && (
                                                                    <>
                                                                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Online Agora"></span>
                                                                        <span className="text-[10px] font-bold text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-800">ONLINE</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <span className="text-gray-400 text-xs">{user.email}</span>
                                                            <span className="text-gray-500 text-[10px] mt-1 font-mono select-all">{user.uid}</span>
                                                            {user.allowedIP && (
                                                                <span className="text-gray-500 text-[10px] mt-0.5">IP: {user.allowedIP}</span>
                                                            )}
                                                            {/* DEBUG: Show DocID in small text */}
                                                            <span className="text-gray-600 text-[9px] mt-0.5 font-mono">Doc: {user.docId}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-300 whitespace-nowrap">
                                                        {user.createdAt.toLocaleDateString('pt-BR')}
                                                        <span className="block text-xs text-gray-500">{user.createdAt.toLocaleTimeString('pt-BR')}</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                            user.subscriptionStatus === 'active' 
                                                            ? 'bg-green-900/50 text-green-300 border border-green-800' 
                                                            : 'bg-red-900/50 text-red-300 border border-red-800'
                                                        }`}>
                                                            {user.subscriptionStatus === 'active' ? 'ATIVO' : 'INATIVO'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                            user.usingOwnKey 
                                                            ? 'bg-blue-900/50 text-blue-300 border border-blue-800' 
                                                            : 'bg-gray-700 text-gray-300 border border-gray-600'
                                                        }`}>
                                                            {user.usingOwnKey ? 'CHAVE PRÓPRIA' : 'SISTEMA'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-white font-medium">
                                                        {user.usage?.remainingTokens?.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => toggleStatus(user.docId, user.subscriptionStatus)}
                                                                className={`p-2 rounded-lg transition-colors shadow-sm border ${
                                                                    user.subscriptionStatus === 'active' 
                                                                    ? 'bg-red-900/30 hover:bg-red-900/50 border-red-900 text-red-400' 
                                                                    : 'bg-green-900/30 hover:bg-green-900/50 border-green-900 text-green-400'
                                                                }`}
                                                                title={user.subscriptionStatus === 'active' ? "Desativar Assinatura" : "Ativar Assinatura"}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    {user.subscriptionStatus === 'active' 
                                                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    }
                                                                </svg>
                                                            </button>
                                                            <button 
                                                                onClick={() => addTokens(user.docId)}
                                                                className="p-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-800 rounded-lg transition-colors shadow-sm"
                                                                title="Adicionar Tokens"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                                </svg>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteUser(user.docId)}
                                                                className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900 rounded-lg transition-colors shadow-sm"
                                                                title="Excluir Usuário"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                                                        Nenhum usuário encontrado com os filtros atuais.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-gray-700/50 p-3 border-t border-gray-700 text-xs text-gray-400 text-center">
                                    Mostrando {filteredUsers.length} de {users.length} usuários
                                </div>
                            </div>
                        )}
                    </>
                ) : activeTab === 'notifications' ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                        {/* Create/Edit Form */}
                        <div className="bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-700">
                            <h2 className="text-2xl font-bold mb-6 text-white border-b border-gray-700 pb-4">
                                {editingId ? 'Editar Notificação' : 'Enviar Notificação do Sistema'}
                            </h2>
                            <p className="text-gray-400 mb-6 text-sm">Esta mensagem aparecerá para <strong>todos</strong> os usuários que clicarem no ícone de notificação no app.</p>
                            
                            <form onSubmit={sendNotification} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Título da Mensagem</label>
                                    <input 
                                        type="text" 
                                        value={notifTitle}
                                        onChange={e => setNotifTitle(e.target.value)}
                                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        placeholder="Ex: Novidade: Modo Escuro Disponível!"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Conteúdo da Mensagem</label>
                                    <textarea 
                                        value={notifMessage}
                                        onChange={e => setNotifMessage(e.target.value)}
                                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 h-32 resize-none"
                                        placeholder="Digite o texto do aviso aqui..."
                                        required
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-300 mb-2">Link do Vídeo (Opcional)</label>
                                        <input 
                                            type="text" 
                                            value={notifVideoUrl}
                                            onChange={e => setNotifVideoUrl(e.target.value)}
                                            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            placeholder="URL do YouTube"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-300 mb-2">Link de Destino (Botão)</label>
                                        <input 
                                            type="text" 
                                            value={notifLinkUrl}
                                            onChange={e => setNotifLinkUrl(e.target.value)}
                                            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            placeholder="https://exemplo.com.br"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Texto do Botão (Se houver link)</label>
                                    <input 
                                        type="text" 
                                        value={notifLinkText}
                                        onChange={e => setNotifLinkText(e.target.value)}
                                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        placeholder="Ex: Clique Aqui, Saiba Mais..."
                                    />
                                </div>
                                
                                <div className="flex gap-4">
                                    <button 
                                        type="submit" 
                                        disabled={sendingNotif}
                                        className={`w-full py-3 font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50 ${editingId ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    >
                                        {sendingNotif ? 'Processando...' : (editingId ? 'Salvar Alterações' : 'Enviar Notificação Global')}
                                    </button>
                                    {editingId && (
                                        <button 
                                            type="button"
                                            onClick={cancelEdit}
                                            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors font-bold"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* History List */}
                        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-700">
                                <h3 className="text-xl font-bold text-white">Histórico de Notificações</h3>
                            </div>
                            <div className="divide-y divide-gray-700">
                                {notificationsHistory.map(notif => (
                                    <div key={notif.id} className="p-6 hover:bg-gray-700/30 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="text-lg font-bold text-white">{notif.title}</h4>
                                                <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full border border-gray-700">
                                                    {notif.createdAt.toLocaleDateString('pt-BR')} {notif.createdAt.toLocaleTimeString('pt-BR')}
                                                </span>
                                            </div>
                                            <p className="text-gray-400 text-sm line-clamp-2">{notif.message}</p>
                                            <div className="flex gap-4 mt-2">
                                                {notif.videoUrl && (
                                                    <a href={notif.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline flex items-center">
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                        Vídeo
                                                    </a>
                                                )}
                                                {notif.linkUrl && (
                                                    <a href={notif.linkUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 text-xs hover:underline flex items-center">
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                                        Link: {notif.linkText || 'Clique Aqui'}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-6">
                                            {/* View Counter */}
                                            <div className="flex flex-col items-center px-4">
                                                <div className="flex items-center text-gray-300 mb-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    <span className="font-bold text-lg text-white">{notif.viewCount || 0}</span>
                                                </div>
                                                <span className="text-xs text-gray-500 uppercase tracking-widest">Visualizações</span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleEditNotification(notif)}
                                                    className="p-2 bg-blue-900/30 text-blue-400 border border-blue-900 rounded-lg hover:bg-blue-900/50 transition-colors"
                                                    title="Editar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteNotification(notif.id)}
                                                    className="p-2 bg-red-900/30 text-red-400 border border-red-900 rounded-lg hover:bg-red-900/50 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {notificationsHistory.length === 0 && (
                                    <div className="p-8 text-center text-gray-500">
                                        Nenhuma notificação enviada ainda.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // BUG REPORTS TAB
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white">Relatórios de Erros e Feedback</h3>
                                <span className="text-xs bg-red-900/40 text-red-300 px-3 py-1 rounded-full border border-red-900">
                                    {bugReports.length} Relatórios
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider border-b border-gray-600">
                                            <th className="p-4 font-semibold">Usuário</th>
                                            <th className="p-4 font-semibold">Contato (WhatsApp)</th>
                                            <th className="p-4 font-semibold w-1/3">Descrição do Erro</th>
                                            <th className="p-4 font-semibold">Print</th>
                                            <th className="p-4 font-semibold">Data</th>
                                            <th className="p-4 font-semibold text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700 text-sm">
                                        {bugReports.map((bug) => (
                                            <tr key={bug.id} className="hover:bg-gray-700/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white">{bug.userName}</span>
                                                        <span className="text-gray-400 text-xs">{bug.userEmail}</span>
                                                        <span className="text-gray-500 text-[10px] mt-1 font-mono">{bug.uid}</span>
                                                        <div className="mt-2">
                                                            <select 
                                                                value={bug.status || 'pending'} 
                                                                onChange={(e) => updateBugStatus(bug.id, e.target.value)}
                                                                className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                                                    bug.status === 'resolved' ? 'bg-green-900/30 text-green-400 border-green-800' :
                                                                    bug.status === 'in-progress' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800' :
                                                                    'bg-red-900/30 text-red-400 border-red-800'
                                                                }`}
                                                            >
                                                                <option value="pending">PENDENTE</option>
                                                                <option value="in-progress">EM ANÁLISE</option>
                                                                <option value="resolved">RESOLVIDO</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {bug.whatsapp && bug.whatsapp !== 'Não informado' ? (
                                                        <a href={`https://wa.me/55${bug.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-green-400 hover:text-green-300">
                                                            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                            {bug.whatsapp}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{bug.description}</p>
                                                </td>
                                                <td className="p-4">
                                                    {bug.screenshotUrl ? (
                                                        <a href={bug.screenshotUrl} target="_blank" rel="noopener noreferrer" className="relative group block w-16 h-16 rounded overflow-hidden border border-gray-600">
                                                            <img src={bug.screenshotUrl} alt="Print" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-500 text-xs">Sem Print</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                                                    {bug.createdAt.toLocaleDateString('pt-BR')}
                                                    <br/>
                                                    {bug.createdAt.toLocaleTimeString('pt-BR')}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button 
                                                        onClick={() => handleDeleteBugReport(bug.id)}
                                                        className="p-2 bg-red-900/30 text-red-400 border border-red-900 rounded-lg hover:bg-red-900/50 transition-colors"
                                                        title="Excluir Relatório"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {bugReports.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                                                    Nenhum relatório de erro encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
      </ErrorBoundary>
    );
};

export default AdminPanel;
