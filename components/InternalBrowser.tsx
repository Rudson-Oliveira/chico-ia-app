// Force reload v2
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { registerRpaIframe, setServerSideMode } from '../services/rpaService';
import { agentService } from '../services/agentService';
import { visionService } from '../services/visionService';
import { rpaClient } from '../services/rpaClient';
import { ConversationMessage } from '../types';
import { getProxyBase } from '../proxyBase';

// Viewport do Chromium server-side (deve casar com VIEWPORT em rpaServer.ts).
const RPA_VIEWPORT = { width: 1280, height: 800 };
type RpaMode = 'checking' | 'server' | 'iframe' | 'unavailable';

interface InternalBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onMicClick?: () => void;
  isMicActive?: boolean;
  messages?: ConversationMessage[];
  onSendMessage?: (text: string) => void;
  isVisionActive?: boolean;
  onToggleVision?: () => void;
  isAiInspecting?: boolean;
}

const InternalBrowser = ({ 
  isOpen, 
  onClose, 
  onMicClick, 
  isMicActive,
  messages = [],
  onSendMessage,
  isVisionActive,
  onToggleVision,
  isAiInspecting
}: InternalBrowserProps) => {
  const [url, setUrl] = useState('https://dev.hospitalarsaude.app.br/#/dashboard/home');
  const [inputUrl, setInputUrl] = useState(url);
  const [env, setEnv] = useState<'dev' | 'prod'>('dev');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isInteractionMode, setIsInteractionMode] = useState(false);
  const [clicks, setClicks] = useState<{x: number, y: number, id: number}[]>([]);
  // Modo server-side (Playwright) x iframe local.
  const [rpaMode, setRpaMode] = useState<RpaMode>('checking');
  const [shot, setShot] = useState<string>('');
  const [serverBusy, setServerBusy] = useState(false);
  const [serverError, setServerError] = useState<string>('');
  const internalIframeRef = useRef<HTMLIFrameElement>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Digitação direta fluida: fila para preservar a ordem das teclas + screenshot com debounce.
  const keyQueueRef = useRef<Promise<any>>(Promise.resolve());
  const shotDebounceRef = useRef<number | null>(null);

  // ResizeObserver to sync canvas with container
  useEffect(() => {
    if (!containerRef.current || !canvasOverlayRef.current) return;
    
    const canvas = canvasOverlayRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Handle postMessage from iframe
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      // Basic logging for now. We can notify the agent if needed.
      console.log("Message from Iframe:", event.data);
      if (typeof event.data === 'object' && event.data.type === 'navigation') {
        setInputUrl(event.data.url);
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  useEffect(() => {
    if (internalIframeRef.current) {
      registerRpaIframe(internalIframeRef.current);
      agentService.setIframeRef(internalIframeRef.current);
    }
  }, [isOpen, rpaMode]);

  // Detecta disponibilidade do RPA server-side ao abrir.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setRpaMode('checking');
    (async () => {
      const available = await rpaClient.isAvailable(true);
      if (cancelled) return;
      if (available) {
        setServerSideMode(true);
        setRpaMode('server');
        // Navega para a URL inicial no browser server-side.
        await runServerNavigate(url);
      } else {
        setServerSideMode(false);
        // Sem Playwright: local usa iframe; publicado mostra aviso.
        setRpaMode(getProxyBase() ? 'unavailable' : 'iframe');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Polling do screenshot enquanto em modo server e aberto.
  useEffect(() => {
    if (rpaMode !== 'server' || !isOpen) return;
    const t = setInterval(async () => {
      if (serverBusy) return;
      const res = await rpaClient.screenshot();
      if (res.ok && res.screenshot) setShot(res.screenshot);
    }, 2000);
    return () => clearInterval(t);
  }, [rpaMode, isOpen, serverBusy]);

  const applyResult = (res: { ok: boolean; screenshot?: string; url?: string; error?: string; message?: string }) => {
    if (res.ok && res.screenshot) setShot(res.screenshot);
    if (res.url) setInputUrl(res.url);
    setServerError(res.ok ? '' : (res.message || res.error || 'Erro na automação.'));
    if (!res.ok && res.message) setRpaMode(getProxyBase() ? 'unavailable' : 'iframe');
  };

  const runServerNavigate = async (target: string) => {
    setServerBusy(true);
    try {
      const res = await rpaClient.navigate(target);
      applyResult(res);
    } finally {
      setServerBusy(false);
    }
  };

  // Converte coordenadas do clique na imagem para o viewport do Chromium.
  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const sx = RPA_VIEWPORT.width / rect.width;
    const sy = RPA_VIEWPORT.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * sx);
    const y = Math.round((e.clientY - rect.top) * sy);
    setServerBusy(true);
    try {
      applyResult(await rpaClient.clickAt(x, y));
    } finally {
      setServerBusy(false);
    }
  };

  // Atualiza a tela ~250ms após a última tecla (evita travar a cada caractere).
  const refreshShotDebounced = () => {
    if (shotDebounceRef.current) window.clearTimeout(shotDebounceRef.current);
    shotDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await rpaClient.screenshot();
        if (res.ok && res.screenshot) setShot(res.screenshot);
      } catch { /* ignore */ }
    }, 250);
  };

  // Encaminha digitação do usuário (com foco na imagem) para o foco atual do Chromium.
  // As teclas são enfileiradas (mantém a ordem) e enviadas sem bloquear a UI; a tela
  // é re-capturada com debounce. Resultado: digitação direta fluida, sem lag por tecla.
  const handleImageKeyDown = (e: React.KeyboardEvent) => {
    if (rpaMode !== 'server') return;
    const special: Record<string, string> = {
      Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Escape',
      ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Delete: 'Delete',
    };
    const isSpecial = e.key in special;
    if (!isSpecial && e.key.length !== 1) return; // ignora modificadores isolados (Shift, Ctrl...)
    e.preventDefault();
    keyQueueRef.current = keyQueueRef.current
      .then(() => (isSpecial ? rpaClient.pressKey(special[e.key]) : rpaClient.type(e.key)))
      .catch(() => { /* ignore */ });
    refreshShotDebounced();
  };

  // Handle drawing on canvas from agent/rpa
  useEffect(() => {
    const handleDraw = (e: any) => {
      const canvas = canvasOverlayRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { x, y, width, height, label, type } = e.detail;
      
      // Select color based on type
      let color = '#00B7FF'; // default blue
      if (type === 'click') color = '#FFEB3B'; // yellow
      if (type === 'type') color = '#4CAF50'; // green

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      if (type === 'click') {
        // Draw pulsing circle
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, width, height);
      }
      
      if (label) {
        ctx.fillStyle = color;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(label, x, y - 5);
      }

      setTimeout(() => {
        if (type === 'click') {
          ctx.clearRect(x - 25, y - 25, 50, 50);
        } else {
          ctx.clearRect(x - 5, y - 25, width + 10, height + 30);
        }
      }, 3000);
    };

    window.addEventListener('agent-draw', handleDraw);
    return () => window.removeEventListener('agent-draw', handleDraw);
  }, []);

  // Navegação disparada pelo agente (função navigateBrowser). Espelha handleNavigate:
  // atualiza a URL e, no modo server, navega o Chromium; no modo iframe, o src segue `url`.
  useEffect(() => {
    const handleAgentNavigate = (e: any) => {
      let target = String(e?.detail?.url || '').trim();
      if (!target) return;
      if (!target.startsWith('http')) target = `https://${target}`;
      setUrl(target);
      setInputUrl(target);
      if (rpaMode === 'server') void runServerNavigate(target);
    };
    window.addEventListener('agent-navigate', handleAgentNavigate);
    return () => window.removeEventListener('agent-navigate', handleAgentNavigate);
  }, [rpaMode]);

  // Após o agente interagir (digitar/clicar) no modo server, re-captura a tela.
  useEffect(() => {
    const handleAgentRefresh = async () => {
      if (rpaMode !== 'server') return;
      setServerBusy(true);
      try { applyResult(await rpaClient.screenshot()); } finally { setServerBusy(false); }
    };
    window.addEventListener('agent-refresh-browser', handleAgentRefresh);
    return () => window.removeEventListener('agent-refresh-browser', handleAgentRefresh);
  }, [rpaMode]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = inputUrl;
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`;
    }
    setUrl(targetUrl);
    setInputUrl(targetUrl);
    if (rpaMode === 'server') void runServerNavigate(targetUrl);
  };

  const refresh = () => {
    if (rpaMode === 'server') {
      void runServerNavigate(url);
    } else if (internalIframeRef.current) {
      internalIframeRef.current.src = url;
    }
  };

  const toggleEnv = (newEnv: 'dev' | 'prod') => {
    setEnv(newEnv);
    const newUrl = newEnv === 'dev' 
      ? 'https://dev.hospitalarsaude.app.br/#/dashboard/home' 
      : 'https://hospitalarsaude.app.br/#/dashboard/home';
    setUrl(newUrl);
    setInputUrl(newUrl);
    if (rpaMode === 'server') void runServerNavigate(newUrl);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !onSendMessage) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const handleVisionAI = async () => {
    if (!onToggleVision) return;
    
    if (!isVisionActive) {
      const success = await visionService.startScreenCapture();
      if (success) onToggleVision();
    } else {
      // Capture and analyze
      const frame = visionService.getCurrentFrame();
      if (frame && onSendMessage) {
        onSendMessage("Analise o que está acontecendo na tela agora.");
      }
    }
  };

  const getProxyUrl = (targetUrl: string) => {
    return `${getProxyBase()}/proxy?url=${encodeURIComponent(targetUrl)}`;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-y-0 right-0 w-full md:w-[85%] lg:w-[80%] xl:w-[75%] bg-[#1a1a1a] shadow-2xl z-40 flex flex-col border-l border-[#333] transition-all duration-300"
    >
      {/* Browser Header */}
      <div className="h-14 bg-[#252525] flex items-center px-4 gap-4 border-b border-[#333] flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-[#333] rounded-lg text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => window.history.forward()} className="p-2 hover:bg-[#333] rounded-lg text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={refresh} className="p-2 hover:bg-[#333] rounded-lg text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={onMicClick}
            className={`p-2 rounded-lg transition-colors ${isMicActive ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-[#333] text-gray-400'}`}
            title="Ativar Microfone"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-[#1a1a1a] rounded-full px-4 py-1.5 border border-[#444] focus-within:border-[#00B7FF] transition-colors">
          <div className="flex items-center gap-2 mr-2">
            <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[150px]">{url}</span>
          </div>
          <input 
            type="text" 
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-200 outline-none"
            placeholder="Search or enter URL"
          />
          <button type="submit" className="text-gray-500 hover:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleVisionAI}
            className={`p-2 rounded-lg transition-all ${isVisionActive ? 'bg-[#00B7FF] text-white shadow-[0_0_15px_rgba(0,183,255,0.5)]' : 'hover:bg-[#333] text-gray-400'}`}
            title="Vision AI - Analisar Tela"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>

          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2 rounded-lg transition-all ${isChatOpen ? 'bg-[#00B7FF] text-white' : 'hover:bg-[#333] text-gray-400'}`}
            title="Chat com IA"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </button>

          <button 
            onClick={() => setIsInteractionMode(!isInteractionMode)}
            className={`p-2 rounded-lg transition-all ${isInteractionMode ? 'bg-[#4CAF50] text-white shadow-[0_0_15px_rgba(76,175,80,0.5)]' : 'hover:bg-[#333] text-gray-400'}`}
            title={isInteractionMode ? "Modo Interação Ativo" : "Modo Interação Inativo"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
          </button>

          <div className="flex bg-[#1a1a1a] rounded-lg p-1 border border-[#333]">
            <button 
              onClick={() => toggleEnv('dev')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${env === 'dev' ? 'bg-[#FF9800] text-black' : 'text-gray-500 hover:text-gray-300'}`}
            >
              DEV
            </button>
            <button 
              onClick={() => toggleEnv('prod')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${env === 'prod' ? 'bg-[#4CAF50] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              PROD
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg text-gray-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Browser Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar decorativo removido para dar largura total ao navegador (era um menu
            fake hardcoded, sem função real; o chat continua acessível pelo ícone na barra). */}
        <div className="hidden">
          <div className="p-6 flex flex-col items-center border-b border-[#333]">
             <div className="w-full mb-6">
                <img src="https://hospitalarsaude.com.br/wp-content/uploads/2021/05/logo-hospitalar-saude.png" alt="Hospitalar" className="h-12 object-contain mx-auto" referrerPolicy="no-referrer" />
             </div>
             <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gray-700 mb-3 overflow-hidden border-2 border-[#444]">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-gray-500 p-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <span className="text-sm font-bold text-gray-200">RUDSON ANTONIO RIBE...</span>
                <button className="text-[10px] text-[#00B7FF] hover:underline mt-1 uppercase font-bold">Editar Perfil</button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-2">
              {[
                { name: 'Administrativo', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                { name: 'Almoxarifado', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
                { name: 'Atualizações do sistema', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
                { name: 'Auditoria', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                { name: 'Recepção', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 5z' },
                { name: 'Chat com IA', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                { name: 'Compras', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
                { name: 'Configurações', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                { name: 'Equipamentos', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
                { name: 'Faturamento', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { name: 'Financeiro', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              ].map((item) => (
                <button 
                  key={item.name} 
                  onClick={() => item.name === 'Chat com IA' && setIsChatOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:bg-[#333] hover:text-gray-200 rounded-lg transition-colors group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:text-[#00B7FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                  </svg>
                  <span className="text-xs font-medium">{item.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-[#333]">
             <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-opacity-10 ${env === 'dev' ? 'bg-orange-500 text-orange-500' : 'bg-green-500 text-green-500'}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${env === 'dev' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                <span className="text-[10px] font-bold uppercase">Visualizando: {env === 'dev' ? 'Desenvolvimento' : 'Produção'}</span>
             </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div ref={containerRef} className="flex-1 bg-white relative">
          {rpaMode === 'checking' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] text-gray-400 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#00B7FF] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs uppercase tracking-widest">Inicializando navegador...</span>
              </div>
            </div>
          )}

          {rpaMode === 'unavailable' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] text-gray-300 z-10 p-8">
              <div className="max-w-md text-center flex flex-col items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#FF9800]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="text-base font-bold text-gray-100">Automação de navegador indisponível</h3>
                <p className="text-sm text-gray-400">A automação de navegador (RPA) está disponível apenas no modo local/desktop. O chat, voz, câmera e compartilhamento de tela continuam funcionando normalmente.</p>
              </div>
            </div>
          )}

          {rpaMode === 'server' && (
            <img
              ref={imgRef}
              src={shot ? `data:image/png;base64,${shot}` : undefined}
              alt="Navegador (server-side)"
              tabIndex={0}
              onClick={handleImageClick}
              onKeyDown={handleImageKeyDown}
              onWheel={(e) => { void rpaClient.scroll(e.deltaY).then(applyResult); }}
              className="w-full h-full object-contain bg-white cursor-pointer outline-none select-none"
              draggable={false}
            />
          )}

          {rpaMode === 'iframe' && (
            <iframe
              ref={internalIframeRef}
              src={getProxyUrl(url)}
              className="w-full h-full border-none"
              title="Internal Browser Content"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation"
            />
          )}

          {rpaMode === 'server' && serverBusy && (
            <div className="absolute top-2 right-2 z-30 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
              <div className="w-2 h-2 bg-[#00B7FF] rounded-full animate-ping"></div> processando
            </div>
          )}
          {rpaMode === 'server' && serverError && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 bg-red-600/80 text-white text-[10px] px-3 py-1 rounded-full">
              {serverError}
            </div>
          )}

          <canvas 
            ref={canvasOverlayRef}
            className="absolute inset-0 pointer-events-none z-20"
          />

          {/* Interaction Overlay (apenas no modo iframe local) */}
          {isInteractionMode && rpaMode === 'iframe' && (
            <div 
              className="absolute inset-0 z-30 cursor-crosshair bg-white/5 active:bg-white/10 transition-colors"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Visual feedback for click
                const clickId = Date.now();
                setClicks(prev => [...prev, { x, y, id: clickId }]);
                setTimeout(() => setClicks(prev => prev.filter(c => c.id !== clickId)), 1000);

                // Send to iframe
                if (internalIframeRef.current?.contentWindow) {
                  internalIframeRef.current.contentWindow.postMessage({
                    type: 'click',
                    x,
                    y
                  }, '*');
                }
              }}
              onWheel={(e) => {
                if (internalIframeRef.current?.contentWindow) {
                  internalIframeRef.current.contentWindow.postMessage({
                    type: 'scroll',
                    deltaY: e.deltaY
                  }, '*');
                }
              }}
            >
              {clicks.map(c => (
                <div 
                  key={c.id}
                  className="absolute animate-ping"
                  style={{ 
                    left: c.x - 10, 
                    top: c.y - 10, 
                    width: 20, 
                    height: 20, 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(0, 183, 255, 0.6)',
                    boxShadow: '0 0 10px #00B7FF'
                  }}
                />
              ))}

              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#4CAF50] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none uppercase tracking-widest">
                Modo Interação Ativo - Cliques serão replicados
              </div>
            </div>
          )}
          
          {/* Vision Indicator Overlay */}
          {isVisionActive && (
            <div className="absolute inset-0 pointer-events-none border-4 border-[#00B7FF] animate-pulse z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#00B7FF] text-white text-[10px] font-bold px-3 py-1 rounded-b-lg">
                VISION AI ATIVO
              </div>
            </div>
          )}

          {/* AI Interaction Indicator */}
          {isAiInspecting && (
            <div className="absolute inset-0 pointer-events-none bg-[#00B7FF]/5 animate-pulse z-10 flex items-center justify-center">
              <div className="bg-[#00B7FF] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                CHICO ESTÁ INSPECIONANDO A PÁGINA...
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar (Acoplado) */}
        {isChatOpen && (
          <div className="w-80 bg-[#1a1a1a] border-l border-[#333] flex flex-col shadow-2xl z-20">
            <div className="h-14 bg-[#252525] flex items-center justify-between px-4 border-b border-[#333]">
              <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">Chat com IA</span>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-500 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] p-3 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-[#00B7FF] text-white rounded-tr-none' : 'bg-[#333] text-gray-200 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 border-t border-[#333] bg-[#252525]">
              <div className="relative">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pergunte algo..."
                  className="w-full bg-[#1a1a1a] text-gray-200 text-xs rounded-xl py-3 pl-4 pr-10 border border-[#444] focus:border-[#00B7FF] outline-none transition-all"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#00B7FF] hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default InternalBrowser;
