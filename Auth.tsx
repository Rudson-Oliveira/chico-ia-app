import React, { useState, useEffect } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, doc, setDoc, getDoc, signOut, serverTimestamp, handleFirestoreError, OperationType } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const ChicoLogo = ({ className = "" }: { className?: string }) => {
    const [name, setName] = useState('Chico');

    useEffect(() => {
        const stored = localStorage.getItem('chicoCustomName');
        if (stored) setName(stored);
    }, []);

    return (
        <div className={`text-5xl font-extrabold leading-tight text-center ${className}`}>
            <span className="text-[var(--text-primary)]">{name}</span><span className="text-[var(--accent-primary)]">IA</span>
        </div>
    );
};

const BrandingSection = () => (
    <div className="bg-[#0f172a] p-6 lg:p-8 flex flex-col justify-center items-center text-center md:w-[35%] min-h-[30vh] md:min-h-screen border-b md:border-b-0 md:border-r border-[#1e293b] relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/10 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 w-full max-w-xs mx-auto flex flex-col items-center justify-center h-full space-y-8">
            <div>
                <ChicoLogo className="mb-4 text-4xl md:text-5xl" />
                <p className="text-gray-400 text-lg font-medium leading-relaxed">
                    Seu companheiro no seu computador.
                </p>
            </div>

            <div className="w-full bg-gradient-to-br from-indigo-900/30 to-purple-900/30 p-5 rounded-xl border border-indigo-500/20 shadow-lg backdrop-blur-sm">
                <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                    Seu companheiro Chico IA, o parceiro de todas as horas <span className="text-yellow-400 font-bold">A custo zero R$ 0,00</span>.
                </p>
                <a
                    href="https://https://hospitalarsaude.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all transform hover:scale-[1.02] shadow-md"
                >
                    Tenha um parceiro
                </a>
            </div>
        </div>
    </div>
);

const Auth = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        
        setLoading(true);
        setError('');

        const fixedPassword = 'password_chico_2024'; // Fixed password for email-only login

        try {
            // Try to sign in
            try {
                await signInWithEmailAndPassword(auth, email, fixedPassword);
            } catch (signInErr: any) {
                console.log("Sign in error code:", signInErr.code);
                // If user doesn't exist, create them
                if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/invalid-email') {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, fixedPassword);
                    const user = userCredential.user;
                    
                    // Initialize profile if it doesn't exist
                    const userPath = `users/${user.uid}`;
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (!userDoc.exists()) {
                            await setDoc(doc(db, "users", user.uid), {
                                uid: user.uid,
                                email: user.email,
                                name: email.split('@')[0],
                                userPreferredName: user.email,
                                subscriptionStatus: 'active',
                                createdAt: serverTimestamp(),
                                theme: 'dark',
                                role: 'user',
                                usage: {
                                    totalTokens: 0,
                                    totalCost: 0,
                                    remainingTokens: 1000000,
                                },
                            });
                        }
                    } catch (fsErr) {
                        handleFirestoreError(fsErr, OperationType.WRITE, userPath);
                    }
                } else if (signInErr.code === 'auth/operation-not-allowed') {
                    setError('O login por email não está ativado no Firebase. Por favor, ative o provedor de Email/Senha no console do Firebase ou use o Google Login.');
                    return;
                } else {
                    throw signInErr;
                }
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            if (err.code === 'auth/operation-not-allowed') {
                setError('O login por email não está ativado. Ative o provedor de Email/Senha no console do Firebase.');
            } else {
                setError(`Erro ao acessar o sistema: ${err.message || 'Verifique seu email.'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Initialize profile if it doesn't exist
            const userPath = `users/${user.uid}`;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (!userDoc.exists()) {
                    await setDoc(doc(db, "users", user.uid), {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || user.email?.split('@')[0] || 'Usuário',
                        userPreferredName: user.displayName || user.email,
                        subscriptionStatus: 'active',
                        createdAt: serverTimestamp(),
                        theme: 'dark',
                        role: 'user',
                        usage: {
                            totalTokens: 0,
                            totalCost: 0,
                            remainingTokens: 1000000,
                        },
                    });
                }
            } catch (fsErr) {
                handleFirestoreError(fsErr, OperationType.WRITE, userPath);
            }
        } catch (err: any) {
            console.error("Google Auth error:", err);
            setError(`Erro ao entrar com Google: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-[#0f172a] text-white">
            <BrandingSection />

            <div className="md:flex-1 flex items-center justify-center p-6 md:p-12 bg-[#0f172a]">
                <div className="w-full max-w-md bg-[#1e293b] p-8 rounded-2xl border border-gray-700 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-2 text-center text-white">Bem-vindo</h2>
                    <p className="text-gray-400 text-center mb-8 text-sm">Digite seu email para entrar no Chico IA</p>
                    
                    {error && (
                        <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm border border-red-500/30 text-center">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-2 ml-1" htmlFor="email">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-4 bg-[#0f172a] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                required
                                disabled={loading}
                            />
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full bg-[#3b82f6] hover:bg-blue-600 text-white font-bold py-4 px-4 rounded-xl focus:outline-none focus:shadow-outline shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                    <span>Entrando...</span>
                                </>
                            ) : (
                                <span>Entrar com Email</span>
                            )}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-[#1e293b] text-gray-500 uppercase tracking-wider">Ou</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-4 rounded-xl focus:outline-none focus:shadow-outline shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                        disabled={loading}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        <span>Entrar com Google</span>
                    </button>
                    
                    <p className="mt-8 text-center text-xs text-gray-500">
                        Ao entrar, você concorda com nossos termos de uso.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
