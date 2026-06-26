import { db, doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, deleteDoc, setDoc, limit, handleFirestoreError, OperationType } from '../firebase';

// Interfaces based on FocoFlow description
export interface FocoFlowTask {
    user_id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done';
    due_date?: Timestamp;
    project_id?: string;
    priority?: 'low' | 'medium' | 'high';
    created_at: any;
}

export interface FocoFlowProject {
    user_id: string;
    name: string;
    description?: string;
    color?: string;
    created_at: any;
}

export interface FocoFlowTransaction {
    user_id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category?: string;
    origin_type?: string; // New field for FocoFlow panel compatibility
    date: number; // Changed to number (timestamp) for consistency
    paymentMethod?: string; // 'money', 'credit', 'pix', 'transfer'
    sourceAccount?: string;
    destinationAccount?: string;
    relatedPerson?: string;
    observations?: string;
    impactsEquity?: boolean;
    created_at: any;
}

// --- CRUD Operations ---

// Since Chico and FocoFlow share the same database and user IDs, 
// we use the Chico user ID directly as the FocoFlow user ID.

export const createFocoFlowTask = async (userId: string, taskData: Partial<FocoFlowTask> & { category?: string }) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_items/${id}`;
    try {
        await setDoc(doc(db, 'focuflow_items', id), {
            user_id: userId,
            title: taskData.title || '',
            description: taskData.description || '',
            status: taskData.status || 'todo',
            priority: taskData.priority || 'medium',
            category: taskData.category || 'task',
            project_id: taskData.project_id || null,
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const createFocoFlowProject = async (userId: string, projectData: Partial<FocoFlowProject>) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_items/${id}`;
    try {
        await setDoc(doc(db, 'focuflow_items', id), {
            user_id: userId,
            name: projectData.name || '',
            description: projectData.description || '',
            color: projectData.color || '#3b82f6',
            category: 'project',
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const createFocoFlowTransaction = async (userId: string, transactionData: any) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_financial_transactions/${id}`;
    
    let transactionDate = now;
    if (transactionData.date) {
        if (typeof transactionData.date === 'number') {
            transactionDate = transactionData.date;
        } else if (typeof (transactionData.date as any).toMillis === 'function') {
            transactionDate = (transactionData.date as any).toMillis();
        } else if (transactionData.date instanceof Date) {
            transactionDate = (transactionData.date as Date).getTime();
        } else if (typeof transactionData.date === 'string') {
            // Handle ISO string from Gemini
            const parsed = new Date(transactionData.date);
            if (!isNaN(parsed.getTime())) {
                transactionDate = parsed.getTime();
            }
        }
    }

    // Determine default origin_type if not provided
    let originType = transactionData.origin_type;
    if (!originType) {
        originType = transactionData.type === 'income' ? 'receita_propria' : 'despesa_propria';
    }

    try {
        await setDoc(doc(db, 'focuflow_financial_transactions', id), {
            user_id: userId,
            description: transactionData.description || '',
            amount: transactionData.amount || 0,
            type: transactionData.type || 'expense',
            category: transactionData.category || 'Geral',
            origin_type: originType,
            date: transactionDate,
            paymentMethod: transactionData.paymentMethod || 'money',
            sourceAccount: transactionData.sourceAccount || '',
            destinationAccount: transactionData.destinationAccount || '',
            relatedPerson: transactionData.relatedPerson || '',
            observations: transactionData.observations || '',
            impactsEquity: transactionData.impactsEquity !== undefined ? transactionData.impactsEquity : true,
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const createFocoFlowReminder = async (userId: string, reminderData: any) => {
    const now = new Date();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_items/${id}`;
    
    let reminderTime = now.getTime();
    if (reminderData.dueDate) {
        const dateStr = reminderData.dueDate;
        // Handle HH:MM or HH:MM:SS format by assuming today's date
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dateStr)) {
            const [hours, minutes, seconds] = dateStr.split(':').map(Number);
            const d = new Date();
            // Use Brazil time for consistency if needed, but here we use local server time
            // which should match the user's expectation if the server/client are aligned.
            // However, the model is instructed with Brazil time.
            d.setHours(hours, minutes, seconds || 0, 0);
            reminderTime = d.getTime();
        } else {
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
                reminderTime = parsedDate.getTime();
            }
        }
    }

    try {
        await setDoc(doc(db, 'focuflow_items', id), {
            category: "reminder",
            createdAt: now,
            id: id,
            reminderTime: reminderTime,
            title: reminderData.title || "Lembrete",
            user_id: userId
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const createFocoFlowLink = async (userId: string, linkData: any) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_items/${id}`;
    try {
        await setDoc(doc(db, 'focuflow_items', id), {
            user_id: userId,
            url: linkData.url || '',
            title: linkData.title || '',
            category: 'link',
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const getFocoFlowData = async (userId: string, collectionName: string = 'focuflow_items', limitCount: number = 20, category?: string, status?: string) => {
    let q = query(
        collection(db, collectionName), 
        where('user_id', '==', userId),
        limit(limitCount)
    );
    
    if (category) {
        q = query(q, where('category', '==', category));
    }

    if (status) {
        q = query(q, where('status', '==', status));
    }
    
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, collectionName);
        return [];
    }
};

export const updateFocoFlowItem = async (id: string, data: any) => {
    const path = `focuflow_items/${id}`;
    try {
        const itemRef = doc(db, 'focuflow_items', id);
        await updateDoc(itemRef, {
            ...data,
            updatedAt: Date.now()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
    }
};

export const deleteFocoFlowItem = async (id: string) => {
    const path = `focuflow_items/${id}`;
    try {
        await deleteDoc(doc(db, 'focuflow_items', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const updateFocoFlowTransaction = async (id: string, data: any) => {
    const path = `focuflow_financial_transactions/${id}`;
    try {
        const transactionRef = doc(db, 'focuflow_financial_transactions', id);
        await updateDoc(transactionRef, {
            ...data,
            updatedAt: Date.now()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
    }
};

export const deleteFocoFlowTransaction = async (id: string) => {
    const path = `focuflow_financial_transactions/${id}`;
    try {
        await deleteDoc(doc(db, 'focuflow_financial_transactions', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const deleteFocoFlowAccount = async (id: string) => {
    const path = `focuflow_accounts/${id}`;
    try {
        await deleteDoc(doc(db, 'focuflow_accounts', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const deleteFocoFlowRecurring = async (id: string) => {
    const path = `focuflow_recurring/${id}`;
    try {
        await deleteDoc(doc(db, 'focuflow_recurring', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const deleteFocoFlowThirdParty = async (id: string) => {
    const path = `focuflow_third_parties/${id}`;
    try {
        await deleteDoc(doc(db, 'focuflow_third_parties', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

// --- New Financial Operations ---

export const createFocoFlowAccount = async (userId: string, accountData: any) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_accounts/${id}`;
    try {
        await setDoc(doc(db, 'focuflow_accounts', id), {
            user_id: userId,
            name: accountData.name || '',
            type: accountData.type || 'Corrente',
            balance: accountData.balance || 0,
            color: accountData.color || '#10b981',
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const createFocoFlowRecurring = async (userId: string, recurringData: any) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_recurring/${id}`;
    try {
        await setDoc(doc(db, 'focuflow_recurring', id), {
            user_id: userId,
            description: recurringData.description || '',
            amount: recurringData.amount || 0,
            type: recurringData.type || 'expense',
            frequency: recurringData.frequency || 'monthly',
            startDate: recurringData.startDate || now,
            nextDate: recurringData.nextDate || now,
            isActive: true,
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const createFocoFlowThirdParty = async (userId: string, thirdPartyData: any) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 10);
    const path = `focuflow_third_parties/${id}`;
    try {
        await setDoc(doc(db, 'focuflow_third_parties', id), {
            user_id: userId,
            name: thirdPartyData.name || '',
            type: thirdPartyData.type || 'other',
            email: thirdPartyData.email || '',
            phone: thirdPartyData.phone || '',
            balance: thirdPartyData.balance || 0,
            createdAt: now,
            id: id
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const getFinancialSummary = async (userId: string) => {
    try {
        // Get all accounts to calculate real balance
        const accountsSnapshot = await getDocs(query(collection(db, 'focuflow_accounts'), where('user_id', '==', userId)));
        const accounts = accountsSnapshot.docs.map(d => d.data());
        const realBalance = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);

        // Get current month transactions
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

        const transactionsSnapshot = await getDocs(query(
            collection(db, 'focuflow_financial_transactions'),
            where('user_id', '==', userId),
            where('date', '>=', startOfMonth),
            where('date', '<=', endOfMonth)
        ));
        const transactions = transactionsSnapshot.docs.map(d => d.data());

        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        // Get pending transactions (A Receber / A Pagar)
        const pendingSnapshot = await getDocs(query(
            collection(db, 'focuflow_financial_transactions'),
            where('user_id', '==', userId),
            where('status', '==', 'pending')
        ));
        const pending = pendingSnapshot.docs.map(d => d.data());
        const toReceive = pending.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const toPay = pending.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        // Get third party balance
        const thirdPartiesSnapshot = await getDocs(query(collection(db, 'focuflow_third_parties'), where('user_id', '==', userId)));
        const thirdPartiesBalance = thirdPartiesSnapshot.docs.reduce((acc, d) => acc + (Number(d.data().balance) || 0), 0);

        return {
            realBalance,
            income,
            expense,
            toReceive,
            toPay,
            thirdPartiesBalance
        };
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'financial_summary');
        return {
            realBalance: 0,
            income: 0,
            expense: 0,
            toReceive: 0,
            toPay: 0,
            thirdPartiesBalance: 0
        };
    }
};

export const getMonthlyFinancialReport = async (userId: string) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

    const q = query(
        collection(db, 'focuflow_financial_transactions'),
        where('user_id', '==', userId),
        where('date', '>=', startOfMonth),
        where('date', '<=', endOfMonth)
    );

    try {
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as FocoFlowTransaction));

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryBreakdown: { [key: string]: number } = {};

        transactions.forEach(t => {
            const amount = Number(t.amount) || 0;
            if (t.type === 'income') {
                totalIncome += amount;
            } else if (t.type === 'expense') {
                totalExpense += amount;
                const cat = t.category || 'Outros';
                categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amount;
            }
        });

        const balance = totalIncome - totalExpense;

        return {
            period: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            totalIncome,
            totalExpense,
            balance,
            categoryBreakdown: Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value })),
            transactionCount: transactions.length
        };
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'focuflow_financial_transactions');
        return {
            period: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            categoryBreakdown: [],
            transactionCount: 0
        };
    }
};

