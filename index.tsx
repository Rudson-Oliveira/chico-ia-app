import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Changed namespace imports to standard default imports for React components.
import App from './App';
import Auth from './Auth';
import { Payment } from './Payment';
import VoiceCommandsPage from './VoiceCommandsPage';
import HelpAndSupportPage from './HelpAndSupportPage';
import TermsAndConditionsPage from './TermsAndConditionsPage';
import SecurityPage from './SecurityPage';
import ImageGeneratorPage from './ImageGeneratorPage';
import AdminPanel from './AdminPanel';
import { auth, onAuthStateChanged, db, doc, onSnapshot, updateDoc, signOut, getDoc, serverTimestamp, handleFirestoreError, OperationType } from './firebase';
import ErrorBoundary from './components/ErrorBoundary';
import type { User } from 'firebase/auth';
import { UserProfile } from './types';
import './index.css';

type SubscriptionStatus = 'loading' | 'active' | 'inactive';

const LoadingScreen = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-white mt-4 font-medium">{message}</p>
    </div>
);

// --- Terms Acceptance Modal Component ---
const TermsAcceptanceModal = ({ onAccept }: { onAccept: () => void }) => {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (contentRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
            // Allow a small buffer (50px) for mobile variances
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                setScrolledToBottom(true);
            }
        }
    };

    // Auto-enable button after 5 seconds just in case scroll detection fails or is annoying
    useEffect(() => {
        const timer = setTimeout(() => setScrolledToBottom(true), 5000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-700">
                <div className="p-6 border-b border-gray-700 bg-[#0f172a]">
                    <h2 className="text-2xl font-bold text-white text-center">Termos de Uso Obrigatórios</h2>
                    <p className="text-gray-400 text-sm text-center mt-2">Por favor, leia e aceite os termos para continuar usando o Chico IA.</p>
                </div>
                
                <div 
                    ref={contentRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-6 space-y-4 text-gray-300 text-sm leading-relaxed"
                >
                    <h3 className="text-lg font-bold text-white">TERMOS DE USO – ACESSO AO SISTEMA CHICO IA</h3>
                    
                    <h4 className="font-bold text-white mt-4">1. DO ACESSO VITALÍCIO AO SISTEMA</h4>
                    <p>O acesso adquirido pelo usuário ao sistema CHICO IA é concedido em caráter vitalício, o que significa que o usuário passa a deter o direito de utilizar a plataforma por prazo indeterminado, de forma contínua e sem a cobrança de mensalidades, anuidades, taxas recorrentes ou qualquer outro valor periódico relacionado ao simples direito de acesso ao sistema, enquanto o sistema permanecer disponível e operando nos termos aqui estabelecidos.</p>
                    <p>O acesso vitalício assegura ao usuário a possibilidade de acessar, utilizar e operar as funcionalidades centrais da plataforma CHICO IA, conforme disponibilizadas no momento da aquisição, independentemente do tempo decorrido desde a compra, preservando-se o direito de uso enquanto a plataforma estiver ativa.</p>
                    <p>O conceito de “acesso vitalício” refere-se exclusivamente ao direito de uso do software CHICO IA em sua forma, estrutura e arquitetura originalmente disponibilizadas, não implicando, por si só, fornecimento gratuito, ilimitado ou vitalício de serviços de terceiros, servidores externos, APIs, créditos computacionais, processamento em nuvem, consumo de inteligência artificial ou qualquer tipo de infraestrutura externa necessária para a operação de determinadas funcionalidades do sistema.</p>
                    <p>Dessa forma, o acesso vitalício garante o uso contínuo da plataforma em si, mas não inclui automaticamente custos, créditos, serviços, processamento ou infraestrutura fornecidos por empresas terceiras, os quais são regidos por políticas próprias e poderão demandar contratação direta por parte do usuário, conforme descrito nos demais termos deste contrato.</p>

                    <h4 className="font-bold text-white mt-4">2. DA INFRAESTRUTURA E DO USO DE APIS</h4>
                    <p>Para o pleno funcionamento de determinadas funcionalidades do sistema CHICO IA, especialmente aquelas que demandam maior capacidade de processamento, automação e recursos de inteligência artificial, é necessária a utilização de infraestrutura tecnológica de terceiros, incluindo, mas não se limitando a, serviços de computação em nuvem, processamento de dados, servidores externos e APIs (Interfaces de Programação de Aplicações) fornecidas por empresas independentes.</p>
                    <p>Como benefício inicial e de caráter promocional, a empresa disponibiliza ao usuário, sem qualquer custo adicional, o uso dessa infraestrutura integrada por um período de até 02 (dois) meses, contados a partir da liberação efetiva do acesso ao sistema, permitindo que o usuário utilize plenamente as funcionalidades que dependem dessa infraestrutura durante esse período.</p>
                    <p>Após o término do período promocional, o usuário poderá continuar utilizando o sistema normalmente por meio da conexão de sua própria conta de API, cujos dados e credenciais deverão ser inseridos diretamente dentro da plataforma CHICO IA, mantendo-se, assim, o pleno funcionamento do sistema.</p>
                    <p>A empresa compromete-se a disponibilizar aulas, manuais, tutoriais e materiais explicativos, de forma clara, simples e acessível, ensinando o passo a passo para a criação, configuração e integração dessas contas externas, incluindo orientações sobre definição de limites de uso, controle de consumo e boas práticas de utilização econômica.</p>
                    <p>Na maioria dos casos, os próprios fornecedores desses serviços externos oferecem créditos promocionais, períodos de uso gratuito ou planos de baixo custo, o que possibilita ao usuário utilizar o sistema com baixo ou nenhum custo adicional, conforme as políticas comerciais e operacionais estabelecidas por cada fornecedor.</p>
                    <p>Eventuais cobranças, taxas, planos, reajustes, limites de consumo ou quaisquer valores relacionados a esses serviços são definidos exclusivamente pelos fornecedores externos, não recaindo sobre a empresa qualquer responsabilidade financeira, contratual ou operacional por tais cobranças ou condições.</p>

                    <h4 className="font-bold text-white mt-4">3. DA CONTINUIDADE DE USO DO SISTEMA</h4>
                    <p>O fornecimento, a manutenção, a substituição ou a eventual descontinuidade de infraestrutura própria por parte da empresa não interferem, em qualquer hipótese, no direito de acesso vitalício concedido ao usuário ao sistema CHICO IA, o qual permanece ativo, disponível e válido, respeitadas as condições estabelecidas nestes Termos de Uso.</p>
                    <p>O acesso vitalício ao sistema é garantido independentemente da fonte da infraestrutura utilizada, assegurando ao usuário o direito de continuar utilizando a plataforma mesmo que a empresa venha a alterar, substituir ou deixar de fornecer a infraestrutura promocional inicialmente disponibilizada.</p>
                    <p>O usuário é plenamente livre para optar pela utilização de sua própria infraestrutura de API, podendo contratar diretamente seus fornecedores externos, inserir suas credenciais no sistema e gerenciar integralmente seus custos, limites de uso, volume de consumo e parâmetros de funcionamento, de acordo com suas necessidades, orçamento e estratégias de utilização.</p>
                    <p>Essa autonomia garante ao usuário maior controle operacional e financeiro, mantendo o pleno funcionamento do sistema CHICO IA, desde que as integrações estejam corretamente configuradas e em conformidade com as versões suportadas da plataforma.</p>

                    <h4 className="font-bold text-white mt-4">4. DAS ATUALIZAÇÕES, MELHORIAS E NOVOS RECURSOS</h4>
                    <p>O acesso vitalício ao sistema CHICO IA inclui, como parte integrante do direito de uso concedido ao usuário, o recebimento de correções de erros (bugs), ajustes técnicos, melhorias de estabilidade, aprimoramentos de desempenho, reforços de segurança e refinamentos de usabilidade, sempre que tais melhorias forem disponibilizadas pela empresa no curso natural da evolução tecnológica do sistema.</p>
                    <p>Essas atualizações visam garantir o funcionamento adequado da plataforma, sua segurança, estabilidade, compatibilidade com novos ambientes tecnológicos e a melhor experiência de uso possível, sendo fornecidas automaticamente, sem custo adicional ao usuário, como parte do compromisso de manutenção do núcleo do sistema.</p>
                    <p>Entretanto, novos recursos, funcionalidades adicionais, módulos independentes, versões ampliadas, integrações avançadas, integrações atualizadas ou quaisquer outros acréscimos que representem uma expansão significativa das capacidades originais do sistema não estão necessariamente incluídos na licença vitalícia básica e poderão ser ofertados separadamente, por meio de novos pacotes, condições comerciais específicas, planos adicionais, compras únicas ou promoções exclusivas, conforme critério da empresa.</p>
                    <p>A disponibilização contínua de melhorias de usabilidade, estabilidade e segurança não caracteriza obrigação de fornecimento gratuito de novas funcionalidades, módulos premium ou expansões de escopo, permanecendo a empresa livre para definir a forma de comercialização de recursos que ampliem significativamente as capacidades do sistema.</p>

                    <h4 className="font-bold text-white mt-4">5. DAS DISPOSIÇÕES FINAIS</h4>
                    <p>A empresa reserva-se o direito de ajustar, atualizar, aprimorar, reorganizar, substituir ou otimizar aspectos técnicos, estruturais, visuais e operacionais do sistema CHICO IA, sempre que tais modificações se mostrarem necessárias para a manutenção, evolução tecnológica, segurança e estabilidade da plataforma, desde que tais alterações não impeçam, limitem ou inviabilizem o acesso do usuário ao sistema conforme contratado.</p>
                    <p>O usuário declara estar plenamente ciente de que o acesso vitalício concedido refere-se exclusivamente ao direito de uso do sistema CHICO IA, conforme disponibilizado em sua arquitetura básica, e que os serviços de terceiros utilizados no funcionamento de determinadas funcionalidades — incluindo, mas não se limitando a APIs, servidores, ferramentas de processamento e infraestrutura externa — possuem termos, políticas e condições próprias, totalmente independentes da empresa, sendo de responsabilidade do usuário a leitura, aceitação e acompanhamento desses contratos externos.</p>
                    <p>A empresa compromete-se a disponibilizar orientações claras, materiais de apoio, tutoriais e conteúdos explicativos, com o objetivo de permitir que o usuário utilize o sistema da forma mais simples, autônoma e economicamente viável possível, de acordo com o modelo operacional descrito nestes Termos de Uso.</p>
                </div>

                <div className="p-6 border-t border-gray-700 bg-[#0f172a] flex flex-col items-center gap-3">
                    <button 
                        onClick={onAccept}
                        disabled={!scrolledToBottom}
                        className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                            scrolledToBottom 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/30' 
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {scrolledToBottom ? 'Li e Aceito os Termos de Uso' : 'Leia até o final para aceitar'}
                    </button>
                    {!scrolledToBottom && (
                        <p className="text-xs text-gray-500 animate-pulse">Role o texto até o final para habilitar o botão.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Color Utility Functions ---

// Convert Hex to RGB
const hexToRgb = (hex: string) => {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
};

// Convert RGB to HSL
const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
};

// Helper to darken/lighten a hex color for hover states (legacy helper, kept for safety)
const adjustColorBrightness = (hex: string, percent: number) => {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
    const newR = Math.max(0, Math.min(255, r + percent));
    const newG = Math.max(0, Math.min(255, g + percent));
    const newB = Math.max(0, Math.min(255, b + percent));
    const toHex = (n: number) => { const h = n.toString(16); return h.length === 1 ? '0' + h : h; };
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

const applyTheme = (theme: string | undefined, customColor: string | undefined) => {
    const root = document.documentElement;
    root.classList.remove('theme-light'); 
    
    // 1. Base Theme Mode (Reset variables if needed)
    if (theme === 'light') {
        root.classList.add('theme-light');
    }

    // 2. Comprehensive Color Application
    // If a custom color is selected, we tint EVERYTHING (backgrounds, sidebars, inputs) 
    // to match that color's hue, creating a totally immersive theme.
    if (customColor) {
        // Set the main accent
        root.style.setProperty('--accent-primary', customColor);
        
        // Calculate Hover Accent
        const hoverColor = adjustColorBrightness(customColor, -15);
        root.style.setProperty('--accent-primary-hover', hoverColor);

        // Generate Background Palette based on the Custom Color
        const [r, g, b] = hexToRgb(customColor);
        const [h, s, l] = rgbToHsl(r, g, b);

        if (theme !== 'light') {
            // DARK MODE GENERATION
            // We use the Hue of the custom color, but clamp saturation and lightness
            // to create professional dark UI tones.

            const bgHue = h;
            // Backgrounds shouldn't be too saturated, it hurts eyes. Limit to 25%.
            const bgSat = Math.min(s, 25); 

            // Primary BG: Very Dark (Brightness ~5%)
            root.style.setProperty('--bg-primary', `hsl(${bgHue}, ${bgSat}%, 5%)`);
            
            // Secondary BG: Sidebar/Cards (Brightness ~10%)
            root.style.setProperty('--bg-secondary', `hsl(${bgHue}, ${bgSat}%, 10%)`);
            
            // Tertiary BG: Inputs/Hover (Brightness ~15%)
            root.style.setProperty('--bg-tertiary', `hsl(${bgHue}, ${bgSat}%, 16%)`);
            
            // Border Color: Slightly lighter than secondary (Brightness ~22%)
            root.style.setProperty('--border-color', `hsl(${bgHue}, ${bgSat}%, 22%)`);
            
            // Text Color adjustments for contrast
            root.style.setProperty('--text-primary', '#F8FAFC');
            root.style.setProperty('--text-secondary', `hsl(${bgHue}, 15%, 75%)`);
            
        } else {
            // LIGHT MODE GENERATION
            // Tint the whites slightly with the custom color for a cohesive look.
             const bgHue = h;
             const bgSat = Math.min(s, 30); 

             root.style.setProperty('--bg-primary', `hsl(${bgHue}, ${bgSat}%, 98%)`);
             root.style.setProperty('--bg-secondary', `hsl(${bgHue}, ${bgSat}%, 100%)`);
             root.style.setProperty('--bg-tertiary', `hsl(${bgHue}, ${bgSat}%, 95%)`);
             root.style.setProperty('--border-color', `hsl(${bgHue}, ${bgSat}%, 88%)`);
             
             // In light mode, text needs to be dark, maybe tinted slightly
             root.style.setProperty('--text-primary', `hsl(${bgHue}, 40%, 10%)`);
             root.style.setProperty('--text-secondary', `hsl(${bgHue}, 20%, 40%)`);
        }

    } else {
        // Fallback/Reset if no custom color is provided
        // We revert to the variables defined in index.html CSS
        root.style.removeProperty('--accent-primary');
        root.style.removeProperty('--accent-primary-hover');
        root.style.removeProperty('--bg-primary');
        root.style.removeProperty('--bg-secondary');
        root.style.removeProperty('--bg-tertiary');
        root.style.removeProperty('--border-color');
        root.style.removeProperty('--text-primary');
        root.style.removeProperty('--text-secondary');
    }
};

const Root = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('loading');
  const [userData, setUserData] = useState<Partial<UserProfile>>({});
  const [route, setRoute] = useState(window.location.hash);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // IP Session Enforcement: Store the current IP for this machine
  const localIpRef = useRef<string | null>(null);

  useEffect(() => {
    // Register Service Worker
    const registerServiceWorker = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(window.location.origin + '/service-worker.js')
          .then((registration) => {
            console.log('Service Worker registrado com sucesso:', registration.scope);
          })
          .catch((error) => {
             if (error.message && error.message.includes('The document is in an invalid state')) {
                 console.warn('Service Worker registration paused: Document invalid state.');
             } else {
                console.error('Falha ao registrar o Service Worker:', error);
             }
          });
      }
    };

    if (document.readyState === 'complete') {
        registerServiceWorker();
    } else {
        window.addEventListener('load', registerServiceWorker);
        return () => window.removeEventListener('load', registerServiceWorker);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange, false);
    return () => {
      window.removeEventListener('hashchange', handleHashChange, false);
    };
  }, []);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    try {
      unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (!currentUser) {
          // For development/preview, we can set a mock user if auth fails or is not needed
          // But here we just set loading to false to show the Auth screen or proceed
          setSubscriptionStatus('inactive');
          setAuthLoading(false);
        }
      });
    } catch (error) {
      console.error("Firebase Auth initialization error:", error);
      setAuthLoading(false);
      setSubscriptionStatus('active'); // Fallback to active to allow guest use
    }

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const setupUserListener = async () => {
        if (!user) return;
        
        // Handle Guest User: Skip Firestore listener for mock guest users
        if (user.uid.startsWith('guest_')) {
            console.log("Guest mode active. Skipping Firestore user listener.");
            setUserData({
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'Visitante',
                subscriptionStatus: 'active',
                role: 'user',
                termsAccepted: true, // Auto-accept for guests
                createdAt: new Date() // Add dummy date for type safety
            } as any as UserProfile);
            setSubscriptionStatus('active');
            setAuthLoading(false);
            return;
        }

        setSubscriptionStatus('loading');
        
        try {
            const uid = user.uid;
            const userDocRef = doc(db, 'users', uid);
            
            // 1. Fetch Public IP and Claim Session
            const fetchAndSetIp = async (docRef: any) => {
                const providers = [
                    'https://api.ipify.org?format=json',
                    'https://api64.ipify.org?format=json',
                    'https://ipapi.co/json/'
                ];
                
                for (const url of providers) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) continue;
                        const data = await response.json();
                        const currentIp = data.ip;
                        
                        if (currentIp) {
                            localIpRef.current = currentIp;
                            const path = docRef.path;
                            // Use updateDoc only if we know the doc exists (called from snapshot)
                            try {
                                await updateDoc(docRef, { allowedIP: currentIp });
                            } catch (error: any) {
                                // If it still fails with not-found, it's okay, we'll try again on next snapshot
                                if (error.code !== 'not-found' && error.code !== 'permission-denied') {
                                    console.warn("IP update failed:", error.message);
                                }
                            }
                            return; // Success
                        }
                    } catch (err) {
                        // Silently try next provider
                    }
                }
                console.warn("Could not fetch public IP for session enforcement.");
            };

            const ipUpdateAttempted = { current: false };

            // 2. Setup Listener on the found document
            const path = userDocRef.path;
            try {
                unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                      const data = docSnap.data() as UserProfile;
                      
                      // Only attempt IP update if the document is fully initialized (has createdAt)
                      // and we haven't successfully updated it in this session yet.
                      if (data.createdAt && !data.allowedIP && !ipUpdateAttempted.current) {
                          ipUpdateAttempted.current = true;
                          fetchAndSetIp(userDocRef);
                      }
            
                      // SECURITY CHECK: Validate Single IP Address
                      if (data.allowedIP && localIpRef.current && data.allowedIP !== localIpRef.current) {
                          if (auth.currentUser) {
                              alert("Sua conta foi conectada em outra rede/local. Você foi desconectado desta sessão para garantir a segurança (Acesso permitido apenas em um IP por vez).");
                              signOut(auth).catch(console.error);
                              return; 
                          }
                      }
            
                      setUserData(data);
                      // Apply theme immediately when data comes from DB
                      applyTheme(data.theme, data.customThemeColor);
                      
                      // Always set to active to allow direct entry as requested
                      setSubscriptionStatus('active');
                      
                      // CHECK FOR TERMS ACCEPTANCE
                      if (!data.termsAccepted) {
                          setShowTermsModal(true);
                      } else {
                          setShowTermsModal(false);
                      }
                    } else {
                        // Se nenhum documento for encontrado, ainda assim permite entrada direta
                        setSubscriptionStatus('active');
                    }
                    setAuthLoading(false);
                }, (error) => {
                    console.error("Firestore permission error or other issue:", error);
                    // Fallback: allow the app to load even if the user document is inaccessible
                    setSubscriptionStatus('active');
                    setAuthLoading(false);
                });
            } catch (snapError) {
                console.error("Error calling onSnapshot:", snapError);
                setSubscriptionStatus('active');
                setAuthLoading(false);
            }
        } catch (error) {
            console.error("Error setting up user listener (outer):", error);
            setSubscriptionStatus('active'); // Changed to active to prevent hang
            setAuthLoading(false);
        }
    };

    if (user) {
        setupUserListener();
    }

    return () => {
        if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [user]);

  const handleAcceptTerms = async () => {
      if (!user) return;
      try {
          const uid = user.uid;
          const userDocRef = doc(db, 'users', uid);

          await updateDoc(userDocRef, {
              termsAccepted: true,
              termsAcceptedAt: serverTimestamp()
          });
          setShowTermsModal(false);
      } catch (e) {
          const uid = user.uid;
          const userDocRef = doc(db, 'users', uid);
          handleFirestoreError(e, OperationType.UPDATE, userDocRef.path);
          alert("Ocorreu um erro ao salvar o aceite. Tente novamente.");
      }
  };

  // Handle Admin Route immediately
  const slug = route.replace('#', '');
  if (slug === '/admin' || slug === 'admin') {
      return <AdminPanel />;
  }

  if (authLoading) {
    return <LoadingScreen message="Carregando..." />;
  }
  
  if (!user) {
    // Guest Mode: Provide a mock user if not logged in
    const guestUser = {
      uid: 'guest_user',
      email: 'guest@example.com',
      displayName: 'Visitante',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
      emailVerified: true
    } as any;
    
    return <App user={guestUser} initialUserData={{...userData, name: 'Visitante'}} onApplyTheme={applyTheme} />;
  }

  if (subscriptionStatus === 'loading') {
    return <LoadingScreen message="Verificando sua assinatura..." />;
  }

  if (subscriptionStatus === 'active') {
    // Show Modal if active but terms not accepted
    if (showTermsModal) {
        return <TermsAcceptanceModal onAccept={handleAcceptTerms} />;
    }

    if (slug === '/comandos-de-voz') {
        return <VoiceCommandsPage />;
    }
    if (slug === '/ajuda-e-suporte') {
        return <HelpAndSupportPage />;
    }
    if (slug === '/termos-e-condicoes') {
        return <TermsAndConditionsPage />;
    }
    if (slug === '/seguranca') {
        return <SecurityPage />;
    }
    if (slug === '/gerador-de-imagens') {
        return <ImageGeneratorPage user={user} />;
    }
    // Pass applyTheme to App so it can be used in preview mode
    return <App user={user} initialUserData={userData} onApplyTheme={applyTheme} />;
  }

  // Default fallback to App instead of Payment to ensure direct entry
  return <App user={user} initialUserData={userData} onApplyTheme={applyTheme} />;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);