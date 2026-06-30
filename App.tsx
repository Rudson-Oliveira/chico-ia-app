import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { evaluate } from 'mathjs';
import { createLiveSession, LiveSessionController, sendTextMessage, summarizeText, transcribeImage, validateApiKey, setUserApiKey as setGeminiUserApiKey, setOpenRouterConfig } from './services/geminiService';
import { 
    createFocoFlowTask, 
    createFocoFlowTransaction, 
    getFocoFlowData, 
    createFocoFlowProject, 
    createFocoFlowReminder, 
    createFocoFlowLink,
    updateFocoFlowItem,
    deleteFocoFlowItem,
    updateFocoFlowTransaction,
    deleteFocoFlowTransaction,
    getMonthlyFinancialReport
} from './services/focoFlowService';
import FocoFlowIntegration from './components/FocoFlowIntegration';
import FinancialReportCard from './components/FinancialReportCard';
import FocoFlowDashboard from './components/FocoFlowDashboard';
import AgentPanel from './components/AgentPanel';
import { agentService } from './services/agentService';
import { ragService } from './services/ragService';
import { visionService } from './services/visionService';
import { shellService } from './services/shellService';
import { taskQueueService } from './services/taskQueueService';
import InternalBrowser from './components/InternalBrowser';
import { 
  executeWorkflow as executeRpaWorkflow, 
  generateWorkflowFromPrompt, 
  stopWorkflow as stopRpaWorkflow,
  onRpaLog,
  getPageMap,
  captureSnapshot,
  rpaService
} from './services/rpaService';
import { rpaClient } from './services/rpaClient';
import ChicoLogo from './components/ChicoLogo';
import LoadingSpinner from './components/LoadingSpinner';
import MessageItem from './components/MessageItem';
import { blobToDataURL, blobToBase64, enviarStatusParaExtensao } from './utils/media';
import VisualHelpModal from './components/VisualHelpModal';
import ConfirmationModal from './components/ConfirmationModal';
import NotificationsModal from './components/NotificationsModal';
import AgentsModal from './components/AgentsModal';
import ArchivedConversationsModal from './components/ArchivedConversationsModal';
import SettingsModal from './components/SettingsModal';
import { SYSTEM_AGENTS } from './constants';
import { ConversationMessage, Conversation, UserProfile, CustomAgent, SystemNotification, RpaWorkflow, RpaLogEntry } from './types';
import { auth, signOut, db, doc, updateDoc, increment, storage, ref, uploadBytes, getDownloadURL, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, getDocs, limit, getDocFromServer, handleFirestoreError, OperationType } from './firebase';
import ErrorBoundary from './components/ErrorBoundary';

// ... (inside the App component or at the top level)

async function testConnection() {
  try {
    // We use a timeout to avoid hanging if the connection is slow
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
    await Promise.race([
        getDocFromServer(doc(db, 'test', 'connection')),
        timeoutPromise
    ]);
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();
import type { User } from 'firebase/auth';

// Cost Constants & Token Estimations
// Pricing for gemini-2.5-flash in USD per 1M tokens (for text)
const GEMINI_FLASH_INPUT_COST_PER_MILLION_TOKENS = 0.35;
const GEMINI_FLASH_OUTPUT_COST_PER_MILLION_TOKENS = 0.70;

// Helper to generate the favicon SVG data URL with a status indicator.
const createFavicon = (isMicActive: boolean): string => {
  const GLogo = `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='70' font-weight='bold' fill='white' font-family='sans-serif'>G</text>`;

  // Red dot for microphone in the top-right corner
  const micDot = isMicActive
    ? `<circle cx='80' cy='20' r='12' fill='#22c55e' stroke='white' stroke-width='2'/>`
    : '';

  const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='#4A5568'/%3E${GLogo}${micDot}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
};

// Helper function to play a short beep sound for feedback.
const playBeep = (context: AudioContext | null, frequency = 440, duration = 100) => {
  if (!context || context.state === 'closed') return;
  if (context.state === 'suspended') {
    context.resume();
  }
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'sine'; // A simple, clean tone
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  
  // Fade out to avoid clicking sound
  gainNode.gain.setValueAtTime(0.3, context.currentTime); // Start at a reasonable volume
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1000);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + duration / 1000);
};

// NEW: Helper function to play a notification sound.
const playNotificationSound = (context: AudioContext | null) => {
    if (!context || context.state === 'closed') return;
    if (context.state === 'suspended') {
        context.resume();
    }
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime); // Higher pitch for notification
    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.15); // Short, sharp sound

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.15);
};

// NEW: Helper function to play an alarm sound.
const playAlarmSound = (context: AudioContext | null) => {
    if (!context || context.state === 'closed') return;
    if (context.state === 'suspended') {
        context.resume();
    }
    const now = context.currentTime;
    
    // Create a double-beep alarm sound
    const playBeepAt = (time: number) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(time);
        osc.stop(time + 0.2);
    };

    playBeepAt(now);
    playBeepAt(now + 0.25);
};


// Estimated costs for other modalities
const ESTIMATED_COST_PER_SECOND_OF_AUDIO = 0.000166; // Approx $0.01/min
const ESTIMATED_COST_PER_IMAGE_FRAME = 0.0025; // An estimate for image analysis
const ESTIMATED_COST_PER_TTS_CHARACTER = 0.000015; // Based on $15 per 1M characters

// Based on pricing, we can estimate token equivalents for non-text modalities
// to provide a unified view of consumption.
const COST_PER_INPUT_TOKEN = GEMINI_FLASH_INPUT_COST_PER_MILLION_TOKENS / 1_000_000;
const COST_PER_OUTPUT_TOKEN = GEMINI_FLASH_OUTPUT_COST_PER_MILLION_TOKENS / 1_000_000;

const ESTIMATED_TOKENS_PER_SECOND_OF_AUDIO = Math.round(ESTIMATED_COST_PER_SECOND_OF_AUDIO / COST_PER_INPUT_TOKEN); // ~474 tokens
const ESTIMATED_TOKENS_PER_IMAGE_FRAME = Math.round(ESTIMATED_COST_PER_IMAGE_FRAME / COST_PER_INPUT_TOKEN); // ~7143 tokens
const ESTIMATED_TOKENS_PER_TTS_CHARACTER = Math.round(ESTIMATED_COST_PER_TTS_CHARACTER / COST_PER_OUTPUT_TOKEN); // ~21 tokens

const TEXT_COMPRESSION_THRESHOLD = 300; // Summarize texts longer than 300 chars
const URL_REGEX = new RegExp('^(https?:\\/\\/)?'+ // protocol
'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
'((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
'(\\:\\d+)+?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
'(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
'(\\#[-a-z\\d_]*)?$','i'); // fragment locator

type Agent = string; // Relaxed type to allow custom IDs

interface AppProps {
  user: User;
  initialUserData: Partial<UserProfile>;
  onApplyTheme?: (theme: string | undefined, customColor: string | undefined) => void;
}

export const App: React.FC<AppProps> = ({ user, initialUserData, onApplyTheme }) => {
  // UI State
  const [isMicActive, setIsMicActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicLoading, setIsMicLoading] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<React.ReactNode | null>(null);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const isImmersiveModeRef = useRef(isImmersiveMode);
  useEffect(() => {
      isImmersiveModeRef.current = isImmersiveMode;
  }, [isImmersiveMode]);
  
  // Conversation History State
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ConversationMessage[]>([]);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Conversation Renaming State
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  // Transcription & Input State
  const [currentInputTranscription, setCurrentInputTranscription] = useState<string>('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState<string>('');
  const [textInput, setTextInput] = useState('');
  
  // Session & Command State
  const [silencePromptVisible, setSilencePromptVisible] = useState(false);
  const [visualHelp, setVisualHelp] = useState<{ image: string; highlight: { x: number; y: number } } | null>(null);
  const [chatToDelete, setChatToDelete] = useState<Conversation | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null); 
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState<Agent>('default');
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]); 
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isSummarizedMode, setIsSummarizedMode] = useState(false); // NEW STATE

  // Usage & API Key State
  const [usageInfo, setUsageInfo] = useState({ totalTokens: initialUserData.usage?.totalTokens || 0, totalCost: initialUserData.usage?.totalCost || 0 });
  const [remainingTokens, setRemainingTokens] = useState(initialUserData.usage?.remainingTokens || 0);
  const [userApiKey, setUserApiKey] = useState<string | null>(() => localStorage.getItem('userChicoApiKey'));
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidatingInSettings, setIsValidatingInSettings] = useState(false);
  const [validationErrorInSettings, setValidationErrorInSettings] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [usdToBrlRate, setUsdToBrlRate] = useState<number | null>(null);

  // Faz o geminiService usar a chave informada pelo usuario (Configuracoes) em
  // TODAS as chamadas (texto, voz/Live, visao). Roda no load e a cada mudanca.
  useEffect(() => { setGeminiUserApiKey(userApiKey || ''); }, [userApiKey]);

  // Salva/limpa a chave do usuario: localStorage + estado + servico.
  const saveUserApiKey = useCallback((key: string) => {
    const trimmed = (key || '').trim();
    if (trimmed) localStorage.setItem('userChicoApiKey', trimmed);
    else localStorage.removeItem('userChicoApiKey');
    setUserApiKey(trimmed || null);
    setGeminiUserApiKey(trimmed);
  }, []);

  // Chaves de servicos backend (Firecrawl/Skyvern): o usuario informa em
  // Configuracoes; o cliente as envia via header e o backend prefere o header.
  const [userFirecrawlKey, setUserFirecrawlKeyState] = useState<string>(() => localStorage.getItem('userFirecrawlKey') || '');
  const [userSkyvernKey, setUserSkyvernKeyState] = useState<string>(() => localStorage.getItem('userSkyvernKey') || '');
  const saveServiceKey = useCallback((storageKey: 'userFirecrawlKey' | 'userSkyvernKey', value: string) => {
    const trimmed = (value || '').trim();
    if (trimmed) localStorage.setItem(storageKey, trimmed);
    else localStorage.removeItem(storageKey);
    if (storageKey === 'userFirecrawlKey') setUserFirecrawlKeyState(trimmed);
    else setUserSkyvernKeyState(trimmed);
  }, []);

  // OpenRouter (economia/fallback de texto): chave + modelo opcionais, informados em
  // Configuracoes. O geminiService usa como plano B se o Gemini falhar numa resposta.
  const [userOpenRouterKey, setUserOpenRouterKeyState] = useState<string>(() => localStorage.getItem('userOpenRouterKey') || '');
  const [userOpenRouterModel, setUserOpenRouterModelState] = useState<string>(() => localStorage.getItem('userOpenRouterModel') || '');
  useEffect(() => { setOpenRouterConfig(userOpenRouterKey || '', userOpenRouterModel || ''); }, [userOpenRouterKey, userOpenRouterModel]);
  const saveOpenRouter = useCallback((key: string, model: string) => {
    const k = (key || '').trim();
    const m = (model || '').trim();
    if (k) localStorage.setItem('userOpenRouterKey', k); else localStorage.removeItem('userOpenRouterKey');
    if (m) localStorage.setItem('userOpenRouterModel', m); else localStorage.removeItem('userOpenRouterModel');
    setUserOpenRouterKeyState(k);
    setUserOpenRouterModelState(m);
  }, []);

  // Settings & Profile State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isFocoFlowModalOpen, setIsFocoFlowModalOpen] = useState(false);
  const [isFocoFlowDashboardOpen, setIsFocoFlowDashboardOpen] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isAiInspecting, setIsAiInspecting] = useState(false);
  const [rpaLogs, setRpaLogs] = useState<RpaLogEntry[]>([]);
  const [isRpaRunning, setIsRpaRunning] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    taskQueueService.startWorker();
    if (videoRef.current) visionService.attachVideoElement(videoRef.current);
    if (iframeRef.current) agentService.setIframeRef(iframeRef.current);

    const unsubscribe = onRpaLog((entry) => {
      setRpaLogs(prev => [...prev, entry].slice(-50));
    });
    return unsubscribe;
  }, []);

  const handleCalculateCommand = async (expression: string) => {
    try {
      const result = evaluate(expression);
      return { result: String(result) };
    } catch (e: any) {
      return { error: `Erro no cálculo: ${e.message}` };
    }
  };

  const handleRpaCommand = async (command: string, args: any) => {
    try {
      switch (command) {
        case 'openBrowser':
          setIsBrowserOpen(true);
          return { success: true, message: "Navegador aberto." };
        case 'closeBrowser':
          setIsBrowserOpen(false);
          return { success: true, message: "Navegador fechado." };
        case 'navigateBrowser': {
          let target = String(args?.url || '').trim();
          if (!target) return { success: false, message: "URL não informada." };
          if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
          const wasOpen = isBrowserOpen;
          if (!wasOpen) setIsBrowserOpen(true);
          const serverReady = await rpaClient.isAvailable();
          if (serverReady) {
            // Modo server (Playwright): navega direto e AGUARDA concluir, para que
            // ações seguintes (digitar/pesquisar) já encontrem a página carregada.
            if (!wasOpen) await new Promise(r => setTimeout(r, 1500)); // deixa o nav inicial assentar
            const r = await rpaClient.navigate(target);
            window.dispatchEvent(new CustomEvent('agent-refresh-browser'));
            return { success: !!r.ok, message: r.ok ? `Página ${target} carregada no navegador.` : (r.message || r.error || 'Falha ao navegar.') };
          }
          // Fallback iframe (sem Playwright)
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('agent-navigate', { detail: { url: target } }));
          }, wasOpen ? 200 : 1200);
          return { success: true, message: `Navegando o navegador interno para ${target}.` };
        }
        case 'runRpaWorkflow':
          if (!isBrowserOpen) setIsBrowserOpen(true);
          setIsRpaRunning(true);
          await executeRpaWorkflow(args.workflow, (stepId, status, result, error) => {
            console.log(`Step ${stepId}: ${status}`, result || error);
          }, true); // useIframe = true
          setIsRpaRunning(false);
          return { success: true, message: "Workflow concluído." };
        case 'generateAndRunRpa':
          const steps = generateWorkflowFromPrompt(args.prompt);
          const workflow: RpaWorkflow = {
            id: crypto.randomUUID(),
            uid: user.uid,
            name: "AI Generated Workflow",
            description: args.prompt,
            steps,
            status: 'idle',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          if (!isBrowserOpen) setIsBrowserOpen(true);
          setIsRpaRunning(true);
          await executeRpaWorkflow(workflow, (stepId, status, result, error) => {
             console.log(`Step ${stepId}: ${status}`, result || error);
          }, true);
          setIsRpaRunning(false);
          return { success: true, message: "Workflow gerado e executado." };
        case 'inspectBrowserPage':
          if (!isBrowserOpen) setIsBrowserOpen(true);
          setIsAiInspecting(true);
          if (await rpaClient.isAvailable()) {
            // Modo server-side (Playwright real): lê o DOM via rpaClient.
            const domRes = await rpaClient.dom();
            setIsAiInspecting(false);
            return {
              success: !!domRes.ok,
              url: domRes.url,
              title: domRes.title,
              interactiveElements: (domRes.elements || []).slice(0, 30),
            };
          }
          const pageMap = await getPageMap();
          const snapshotSummary = await captureSnapshot();
          setIsAiInspecting(false);
          return {
            success: true,
            summary: snapshotSummary,
            interactiveElements: (pageMap.elements || []).slice(0, 30) // Limit to avoid token bloat
          };
        case 'interactWithBrowser':
          if (!isBrowserOpen) setIsBrowserOpen(true);
          setIsAiInspecting(true);
          const { action, selector, value } = args;
          let interactResult = "";
          try {
            if (await rpaClient.isAvailable()) {
              // Modo server-side (Playwright real): age direto no Chromium via rpaClient.
              let r: { ok: boolean; error?: string; message?: string };
              if (action === 'type') {
                // Sem seletor -> digita no campo focado (ex.: caixa de busca do Google).
                r = await rpaClient.type(String(value ?? ''), selector || undefined, true);
                interactResult = r.ok ? `Digitado "${value}"${selector ? ' em ' + selector : ''}.` : (r.message || r.error || 'Falha ao digitar.');
              } else if (action === 'press') {
                r = await rpaClient.pressKey(String(value || 'Enter'));
                interactResult = r.ok ? `Tecla ${value || 'Enter'} pressionada.` : (r.message || r.error || 'Falha na tecla.');
              } else if (action === 'click') {
                r = selector ? await rpaClient.clickSelector(selector) : await rpaClient.clickAt(Number(args.x) || 0, Number(args.y) || 0);
                interactResult = r.ok ? `Clique em ${selector || `(${args.x},${args.y})`} ok.` : (r.message || r.error || 'Falha no clique.');
              } else if (action === 'scroll') {
                r = await rpaClient.scroll(value === 'up' ? -400 : 400);
                interactResult = r.ok ? `Scroll ${value} ok.` : (r.message || r.error || 'Falha no scroll.');
              } else {
                r = { ok: false };
                interactResult = `Ação "${action}" não suportada no navegador atual.`;
              }
              // Atualiza a tela do navegador interno após a interação.
              window.dispatchEvent(new CustomEvent('agent-refresh-browser'));
              setIsAiInspecting(false);
              return { success: r.ok, message: interactResult };
            }
            if (action === 'click') {
              // Trigger visual indicator on client side (canvas)
              const pageMap = await rpaService.getPageMap();
              const el = pageMap.elements.find((e: any) => e.selector === selector || e.id === selector || e.text === selector);
              if (el && el.rect) {
                window.dispatchEvent(new CustomEvent('agent-draw', { 
                  detail: { x: el.rect.x, y: el.rect.y, width: el.rect.width, height: el.rect.height, label: `Click: ${selector}`, type: 'click' } 
                }));
              }

              const interactionStep = rpaService.createStep('click', `AI Task: ${action}`, { selector });
              const tempWorkflow: RpaWorkflow = {
                id: 'temp', uid: user.uid, name: 'temp', description: 'temp',
                steps: [interactionStep], status: 'idle', createdAt: new Date(), updatedAt: new Date()
              };
              await executeRpaWorkflow(tempWorkflow, () => {}, true);
              interactResult = `Ação ${action} executada em ${selector}`;
            } else if (action === 'type') {
              await rpaService.fillForm({ [selector]: value });
              interactResult = `Digitado "${value}" em ${selector}`;
            } else if (action === 'scroll') {
              await rpaService.scrollPage(value as any, selector);
              interactResult = `Scroll ${value} executado em ${selector || 'página'}`;
            } else if (action === 'select') {
               const interactionStep = rpaService.createStep('type', `AI Task: select ${value}`, { selector, text: value });
               const tempWorkflow: RpaWorkflow = {
                 id: 'temp', uid: user.uid, name: 'temp', description: 'temp',
                 steps: [interactionStep], status: 'idle', createdAt: new Date(), updatedAt: new Date()
               };
               await executeRpaWorkflow(tempWorkflow, () => {}, true);
               interactResult = `Selecionado "${value}" em ${selector}`;
            }
          } catch (err: any) {
             interactResult = `Erro na interação: ${err.message}`;
          }
          setIsAiInspecting(false);
          return { success: true, message: interactResult };
        case 'getSystemFlows':
          const flows = {
            'cadastro_pessoa': {
              title: 'Cadastro de Pessoa',
              steps: [
                'Navegar para a página de cadastros',
                'Clicar em "Novo Registro"',
                'Preencher Nome, CPF e Data de Nascimento',
                'Clicar em "Salvar"'
              ],
              selectors: {
                'novo_btn': '#btn-new-record',
                'nome_input': 'input[name="full_name"]',
                'cpf_input': 'input[name="cpf"]',
                'save_btn': '.btn-primary.save'
              }
            },
            'faturamento': {
              title: 'Fluxo de Faturamento',
              steps: [
                'Acessar o módulo Financeiro',
                'Selecionar "Faturamento"',
                'Escolher o cliente e o valor',
                'Gerar Nota Fiscal'
              ]
            }
          };
          const flowName = args.flowName;
          if (flowName && (flows as any)[flowName]) {
            return { success: true, flow: (flows as any)[flowName] };
          }
          return { success: true, allFlows: flows };
        case 'scrollPage':
          if (!isBrowserOpen) setIsBrowserOpen(true);
          await rpaService.scrollPage(args.direction, args.selector);
          return { success: true, message: `Scroll ${args.direction} executado.` };
        case 'hoverElement':
          if (!isBrowserOpen) setIsBrowserOpen(true);
          await rpaService.hoverElement(args.selector);
          return { success: true, message: `Hover executado em ${args.selector}.` };
        case 'waitForElement':
          if (!isBrowserOpen) setIsBrowserOpen(true);
          const waitResult = await rpaService.waitForElement(args.selector, args.timeout);
          return { success: true, message: waitResult };
        default:
          return { success: false, message: "Comando RPA desconhecido." };
      }
    } catch (err: any) {
      console.error("RPA Command Error:", err);
      setIsRpaRunning(false);
      return { success: false, error: err.message };
    }
  };

  const handleWebCommand = async (command: string, args: any) => {
    try {
      const { webClient } = await import('./services/webClient');
      if (command === 'ler_pagina') {
        const url = String(args?.url || '').trim();
        if (!url) return { success: false, message: 'URL não informada.' };
        const res = await webClient.read(url.startsWith('http') ? url : `https://${url}`);
        if (!res.ok) return { success: false, message: res.message || res.error || 'Falha ao ler a página.' };
        const content = res.markdown || res.text || '';
        return {
          success: true,
          source: res.source,
          message: `Conteúdo de ${res.title || res.url || url} (via ${res.source}):\n\n${content.slice(0, 6000)}`,
        };
      }
      if (command === 'pesquisar') {
        const res = await webClient.search(String(args?.query || ''), args?.limit);
        if (!res.ok) return { success: false, message: res.message || res.error || 'Falha na pesquisa.' };
        const list = (res.results || [])
          .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`)
          .join('\n\n');
        return { success: true, source: res.source, message: list || 'Nenhum resultado encontrado.' };
      }
      if (command === 'extrair') {
        const url = String(args?.url || '').trim();
        const res = await webClient.extract(url.startsWith('http') ? url : `https://${url}`, undefined, args?.campos);
        if (!res.ok) return { success: false, message: res.message || res.error || 'Falha na extração.' };
        return { success: true, source: res.source, message: `Dados extraídos de ${res.title || url}:\n\n${JSON.stringify(res.data, null, 2)}` };
      }
      return { success: false, message: 'Comando web desconhecido.' };
    } catch (err: any) {
      console.error('Web Command Error:', err);
      return { success: false, message: err?.message || 'Erro ao executar comando web.' };
    }
  };

  const handleSkyvernCommand = async (args: any) => {
    try {
      const objetivo = String(args?.objetivo || '').trim();
      if (!objetivo) return { success: false, message: 'Objetivo da tarefa não informado.' };
      const url = String(args?.url || '').trim();
      const { skyvernClient } = await import('./services/skyvernClient');

      // Orienta o Skyvern a devolver os dados extraídos como output estruturado.
      const objetivoComExtracao = `${objetivo}\n\nIMPORTANTE: ao concluir, RETORNE os dados solicitados de forma estruturada (JSON) como resultado/output final da tarefa.`;
      const run = await skyvernClient.run(objetivoComExtracao, url ? (url.startsWith('http') ? url : `https://${url}`) : undefined);
      if (!run.ok || !run.taskId) {
        return { success: false, message: run.message || run.error || 'Não foi possível iniciar a tarefa autônoma.' };
      }
      addMessage('system', `Tarefa autônoma iniciada (Skyvern). Acompanhando o progresso...${run.appUrl ? `\nDetalhes: ${run.appUrl}` : ''}`);

      let lastStatus = '';
      const final = await skyvernClient.waitUntilDone(run.taskId, {
        onProgress: (s) => {
          if (s.ok && s.status && s.status !== lastStatus) {
            lastStatus = s.status;
            addMessage('system', `Progresso da tarefa: ${s.status}${s.stepCount ? ` (passo ${s.stepCount})` : ''}.`);
          }
        },
      });

      if (!final.ok) return { success: false, message: final.message || final.error || 'Falha ao acompanhar a tarefa.' };
      if (final.status === 'completed') {
        if (final.output) {
          const out = typeof final.output === 'string' ? final.output : JSON.stringify(final.output, null, 2);
          return { success: true, message: `Tarefa autônoma concluída com sucesso.\n\nResultado:\n${out}` };
        }
        // Concluiu, mas o Skyvern não retornou dado estruturado: aponta a gravação/painel.
        const link = run.appUrl || final.appUrl || final.recordingUrl;
        return {
          success: true,
          message: `Tarefa autônoma concluída com sucesso.${link ? `\nO Skyvern não retornou um dado estruturado; veja a execução/resultado em: ${link}` : ' (sem dado estruturado de retorno)'}`,
        };
      }
      const reason = final.failureReason ? `\nMotivo: ${final.failureReason}` : '';
      return { success: true, message: `Tarefa autônoma finalizou com status "${final.status}".${reason}${final.message ? `\n${final.message}` : ''}` };
    } catch (err: any) {
      console.error('Skyvern Command Error:', err);
      return { success: false, message: err?.message || 'Erro ao executar a tarefa autônoma.' };
    }
  };

  const handleTranscribeImageCommand = async (fileData?: { base64: string; mimeType: string }) => {
    try {
      if (!fileData?.base64) {
        return { success: false, message: 'Nenhuma imagem foi anexada para transcrever. Peça ao usuário para anexar uma foto/print.' };
      }
      const text = await transcribeImage(fileData.base64, fileData.mimeType || 'image/jpeg');
      if (!text) return { success: false, message: 'Não consegui identificar texto na imagem.' };
      return { success: true, message: `Texto transcrito da imagem:\n\n${text}` };
    } catch (err: any) {
      console.error('Transcribe Image Error:', err);
      return { success: false, message: err?.message || 'Erro ao transcrever a imagem.' };
    }
  };

  const handleFocoFlowCommand = async (command: string, args: any) => {
    try {
        switch (command) {
            case 'createFocoFlowTask':
                await createFocoFlowTask(user.uid, args);
                return { success: true, message: "Tarefa criada no FocoFlow." };
            case 'createFocoFlowProject':
                await createFocoFlowProject(user.uid, args);
                return { success: true, message: "Projeto criado no FocoFlow." };
            case 'createFocoFlowReminder':
                await createFocoFlowReminder(user.uid, args);
                return { success: true, message: "Lembrete criado no FocoFlow." };
            case 'createFocoFlowTransaction':
                await createFocoFlowTransaction(user.uid, args);
                return { success: true, message: "Transação registrada no FocoFlow." };
            case 'createFocoFlowLink':
                await createFocoFlowLink(user.uid, args);
                return { success: true, message: "Link salvo no FocoFlow." };
            case 'getFocoFlowData':
                const data = await getFocoFlowData(user.uid, args.collectionName, args.limit, args.category, args.status);
                return { success: true, data };
            case 'updateFocoFlowItem':
                await updateFocoFlowItem(args.id, args.data);
                return { success: true, message: "Item atualizado no FocoFlow." };
            case 'deleteFocoFlowItem':
                await deleteFocoFlowItem(args.id);
                return { success: true, message: "Item excluído do FocoFlow." };
            case 'updateFocoFlowTransaction':
                await updateFocoFlowTransaction(args.id, args.data);
                return { success: true, message: "Transação atualizada no FocoFlow." };
            case 'deleteFocoFlowTransaction':
                await deleteFocoFlowTransaction(args.id);
                return { success: true, message: "Transação excluída do FocoFlow." };
            case 'getMonthlyFinancialReport':
                const report = await getMonthlyFinancialReport(user.uid);
                return { success: true, report };
            default:
                return { error: "Comando desconhecido." };
        }
    } catch (e: any) {
        return { error: e.message };
    }
  };

  const handleExternalIntegrationCommand = async (name: string, args: any) => {
    const { prompt, model } = args;
    console.log(`Calling external integration: ${name}`, args);
    
    try {
        if (name === 'callOpenClaw') {
            if (!integrations?.openClaw?.enabled) return { error: "OpenClaw não está habilitado." };
            const url = integrations.openClaw.useRemote ? integrations.openClaw.remoteUrl : integrations.openClaw.localUrl;
            if (!url) return { error: "URL do OpenClaw não configurada." };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await response.json();
            return { result: data.response || data.text || JSON.stringify(data) };
        }
        
        if (name === 'callOllama') {
            if (!integrations?.ollama?.enabled) return { error: "Ollama não está habilitado." };
            const url = integrations.ollama.url || 'http://localhost:11434';
            
            const response = await fetch(`${url}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: model || 'llama3', 
                    prompt,
                    stream: false 
                })
            });
            const data = await response.json();
            return { result: data.response || JSON.stringify(data) };
        }
        
        if (name === 'callClaudeCode') {
            if (!integrations?.claudeCode?.enabled) return { error: "Claude Code não está habilitado." };
            const apiKey = integrations.claudeCode.apiKey;
            if (!apiKey) return { error: "API Key do Claude não configurada." };
            
            // Note: Direct browser calls to Anthropic API might be blocked by CORS.
            // In a real app, this should go through a backend proxy.
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'dangerouslyAllowBrowser': 'true' // Some SDKs/APIs might need this if they allow it
                },
                body: JSON.stringify({
                    model: "claude-3-5-sonnet-20240620",
                    max_tokens: 1024,
                    messages: [{ role: "user", content: prompt }]
                })
            });
            const data = await response.json();
            return { result: data.content?.[0]?.text || JSON.stringify(data) };
        }
    } catch (e: any) {
        console.error(`Error calling ${name}:`, e);
        return { error: `Erro ao chamar ${name}: ${e.message}` };
    }
    
    return { error: "Comando desconhecido." };
  };
  const handleSearchPastConversationsCommand = useCallback(async (queryStr: string, limitCount: number = 10) => {
    console.log("Searching past conversations for:", queryStr);
    if (!user) return { error: "Usuário não autenticado." };

    try {
      const convosQuery = query(collection(db, 'conversations'), where('uid', '==', user.uid));
      const convosSnapshot = await getDocs(convosQuery);
      
      if (convosSnapshot.empty) return { result: "Nenhuma conversa anterior encontrada." };

      const sortedConvos = convosSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))
        .slice(0, 10); // Check more conversations

      let results: any[] = [];
      for (const convo of sortedConvos) {
        const msgQuery = query(
          collection(db, `conversations/${convo.id}/messages`),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const msgSnapshot = await getDocs(msgQuery);
        msgSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.text && data.text.toLowerCase().includes(queryStr.toLowerCase())) {
            results.push({
              convoTitle: convo.title,
              role: data.role,
              text: data.text,
              timestamp: data.timestamp?.toDate().toLocaleString() || 'Data desconhecida'
            });
          }
        });
      }

      if (results.length === 0) {
        return { result: `Não encontrei referências diretas a "${queryStr}" no histórico recente.` };
      }

      // Sort results by timestamp (most recent first)
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return { 
        result: `Encontrei as seguintes referências no histórico para "${queryStr}":\n` + 
        results.slice(0, limitCount).map(r => `[${r.timestamp}] na conversa "${r.convoTitle}" - ${r.role}: ${r.text}`).join('\n')
      };

    } catch (error) {
      console.error("Error searching past conversations:", error);
      return { error: "Erro ao buscar no histórico." };
    }
  }, [user]);

  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false); // NEW STATE for Archived Conversations Modal
  const [profilePicUrl, setProfilePicUrl] = useState(initialUserData.profilePicUrl || null);
  const [theme, setTheme] = useState(initialUserData.theme || 'dark');
  const [customThemeColor, setCustomThemeColor] = useState(initialUserData.customThemeColor || '#00B7FF');
  const [tempColor, setTempColor] = useState(initialUserData.customThemeColor || '#00B7FF'); 
  const [voiceName, setVoiceName] = useState(initialUserData.voiceName || 'Kore'); 
  const [chicoCustomName, setChicoCustomName] = useState(initialUserData.chicoCustomName || 'Chico');
  const [userPreferredName, setUserPreferredName] = useState(initialUserData.userPreferredName || '');
  const [integrations, setIntegrations] = useState(initialUserData.integrations || {});
  const [socialLinks, setSocialLinks] = useState(initialUserData.socialLinks || {});
  const [isTextToSpeechEnabled, setIsTextToSpeechEnabled] = useState(initialUserData.textToSpeechEnabled || false); // NEW State for TTS
  const [isUploading, setIsUploading] = useState(false);

  // Persist custom assistant name to localStorage for Auth screen
  useEffect(() => {
      if (chicoCustomName) {
          localStorage.setItem('chicoCustomName', chicoCustomName);
      }
  }, [chicoCustomName]);

  // Notification System State
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const hasPlayedNotificationSoundRef = useRef(false); // NEW: To prevent multiple notification sounds
  const [ringingAlarms, setRingingAlarms] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]); // NEW: State to hold all reminders
  const alarmIntervalRef = useRef<number | null>(null);

  // Refs
  const liveSessionControllerRef = useRef<LiveSessionController | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null); 
  const audioAnalyserRef = useRef<AnalyserNode | null>(null); // NEW: Audio Analyser Ref
  const animationFrameRef = useRef<number | null>(null); // NEW: Animation Loop Ref
  const silenceTimerRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const usageUpdateRef = useRef({ tokenDelta: 0, costDelta: 0 });
  const firestoreUpdateTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null); // NEW: Visualizer Canvas Ref
  const immersiveCanvasRef = useRef<HTMLCanvasElement>(null); // NEW: Immersive Canvas Ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  
  // NEW: Inactivity Timer Ref
  const inactivityTimerRef = useRef<number | null>(null);
  
  // Scrolling Logic Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); // Default to true so it starts at bottom

  // Refs for State (Fix Stale Closures in Event Listeners)
  const isMicActiveRef = useRef(isMicActive);
  const isScreenSharingRef = useRef(isScreenSharing);
  const isCameraActiveRef = useRef(isCameraActive);
  
  // Prevent duplicate messages
  const lastProcessedResponseRef = useRef<string>('');
  const lastMicActivityRef = useRef<number>(Date.now());


  // Efeito para atualizar o favicon, mostrando um ponto vermelho quando o microfone está ativo.
  useEffect(() => {
    const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
    if (favicon) {
      favicon.href = createFavicon(isMicActive);
    }
  }, [isMicActive]);
  
  // Sync Refs with State
  useEffect(() => { isMicActiveRef.current = isMicActive; }, [isMicActive]);
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);
  useEffect(() => { isCameraActiveRef.current = isCameraActive; }, [isCameraActive]);

  // Previous state ref for mic active status to detect change
  const prevIsMicActiveRef = useRef<boolean>(isMicActive);
  
  // Effect to play a sound when the microphone is turned off.
  useEffect(() => {
    if (prevIsMicActiveRef.current && !isMicActive) {
      // Play a low-pitched beep to indicate 'off'
      // Note: We only play sound here if state changed. The actual logic is in disconnectSession or handleToggle
      // window.speechSynthesis.cancel(); // Stopped in handler
    }
    prevIsMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  // AUTO-RESUME AUDIO CONTEXT LOOP (Heartbeat to prevent freeze)
  useEffect(() => {
    if (!isMicActive) return;
    
    const checkAudioContext = async () => {
        const now = Date.now();
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'running') {
            console.log("Auto-resuming input audio context...");
            try {
                await inputAudioContextRef.current.resume();
            } catch (e) {
                console.warn("Failed to auto-resume input ctx", e);
            }
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'running') {
            console.log("Auto-resuming output audio context...");
            try {
                await outputAudioContextRef.current.resume();
            } catch (e) {
                console.warn("Failed to auto-resume output ctx", e);
            }
        }

        // If context is closed or still not running after resume, it might be dead
        if (isMicActiveRef.current && (
            !inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed' ||
            !outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed'
        )) {
            console.warn("AudioContext detected as dead while mic is active. Forcing recovery...");
            handleToggleMicrophone(true);
            return;
        }

        // MIC ACTIVITY CHECK: If mic is active but no data processed for 5s, restart
        const isModelSpeaking = liveSessionControllerRef.current?.isModelSpeaking() || false;
        if (isMicActiveRef.current && !isModelSpeaking && (now - lastMicActivityRef.current > 5000)) {
            console.warn("Mic activity lost for 5s. Forcing recovery...");
            handleToggleMicrophone(true);
        }
    };

    const interval = setInterval(checkAudioContext, 2000);
    return () => clearInterval(interval);
  }, [isMicActive]);

  // Ensure video element stays in sync with stream state to fix visibility issues
  useEffect(() => {
    if (videoRef.current) {
        if (isCameraActive && cameraStreamRef.current) {
            if (videoRef.current.srcObject !== cameraStreamRef.current) {
                videoRef.current.srcObject = cameraStreamRef.current;
                videoRef.current.play().catch(e => console.warn("Video play error (camera):", e));
            }
        } else if (isScreenSharing && screenStreamRef.current) {
             if (videoRef.current.srcObject !== screenStreamRef.current) {
                videoRef.current.srcObject = screenStreamRef.current;
                videoRef.current.play().catch(e => console.warn("Video play error (screen):", e));
            }
        }
    }
  }, [isCameraActive, isScreenSharing]);

  // --- PRESENCE SYSTEM (Online Status) ---
  useEffect(() => {
      if (!user) return;

      const updatePresence = async () => {
          try {
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                  lastSeen: serverTimestamp()
              });
          } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
          }
      };

      updatePresence();
      const interval = setInterval(updatePresence, 60000);

      const handleVisibilityChange = () => {
          if (!document.hidden) {
              updatePresence();
          }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [user]);

  // Derived state for active and archived conversations
  const { activeConversations, archivedConversations } = useMemo(() => {
    const active: Conversation[] = [];
    const archived: Conversation[] = [];
    allConversations.forEach(convo => {
      if (convo.isArchived) {
        archived.push(convo);
      } else {
        active.push(convo);
      }
    });
    return { activeConversations: active, archivedConversations: archived };
  }, [allConversations]);

  const addMessage = useCallback(async (
      role: 'user' | 'model' | 'system', 
      text: string, 
      options: {
          summary?: string;
          imageUrl?: string;
          fileName?: string;
          blockType?: 'code' | 'text' | 'prompt';
      } = {}
  ): Promise<string | null> => {
      if (!activeConversationId) return null;
      try {
          const { summary, imageUrl, fileName, blockType } = options;
          const messageData = { 
              role, 
              text, 
              uid: user?.uid, // Added uid for easier cross-conversation searching in future
              timestamp: serverTimestamp(), 
              ...(summary && { summary }), 
              ...(imageUrl && { imageUrl }), 
              ...(fileName && { fileName }),
              ...(blockType && { blockType }) 
          };
          const messageRef = await addDoc(collection(db, `conversations/${activeConversationId}/messages`), messageData);
          return messageRef.id;
      } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `conversations/${activeConversationId}/messages`);
          setErrorMessage("Falha ao salvar a mensagem.");
          return null;
      }
  }, [activeConversationId]);

  const checkAndSaveProgrammingLevel = useCallback(async (userMessage: string) => {
    if (activeAgent === 'programmer' && !initialUserData.programmingLevel) {
      const messageLower = userMessage.toLowerCase().trim();
      let level: 'basic' | 'intermediate' | 'advanced' | null = null;

      const basicTerms = ['básico', 'basico', 'iniciante', 'basic', 'beginner'];
      const intermediateTerms = ['intermédio', 'intermediário', 'intermediario', 'medio', 'medium', 'intermediate'];
      const advancedTerms = ['avançado', 'avancado', 'expert', 'especialista', 'senior', 'advanced'];

      if (basicTerms.some(term => messageLower.includes(term))) {
        level = 'basic';
      } else if (intermediateTerms.some(term => messageLower.includes(term))) {
        level = 'intermediate';
      } else if (advancedTerms.some(term => messageLower.includes(term))) {
        level = 'advanced';
      }
      
      if (level) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, { programmingLevel: level });
          addMessage('system', `Seu nível de programação foi salvo como: ${level}.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
          setErrorMessage("Não foi possível salvar seu nível de programação.");
        }
      }
    }
  }, [activeAgent, initialUserData.programmingLevel, user.uid, addMessage]);

  // Sync internal state with props from Firestore listener
  useEffect(() => {
    setProfilePicUrl(initialUserData.profilePicUrl || null);
    setTheme(initialUserData.theme || 'dark');
    setCustomThemeColor(initialUserData.customThemeColor || '#00B7FF');
    setTempColor(initialUserData.customThemeColor || '#00B7FF');
    setVoiceName(initialUserData.voiceName || 'Kore');
    setIsTextToSpeechEnabled(initialUserData.textToSpeechEnabled || false);
    setSocialLinks(initialUserData.socialLinks || {});
    setRemainingTokens(initialUserData.usage?.remainingTokens || 0);
    setUsageInfo({
      totalTokens: initialUserData.usage?.totalTokens || 0,
      totalCost: initialUserData.usage?.totalCost || 0
    });
  }, [initialUserData]);

  // Fetch System Notifications
  useEffect(() => {
    const q = query(
        collection(db, 'system_notifications'),
        orderBy('createdAt', 'desc'),
        limit(5)
    );

    const path = 'system_notifications';
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const notifs: SystemNotification[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            notifs.push({
                id: doc.id,
                title: data.title,
                message: data.message,
                videoUrl: data.videoUrl,
                linkUrl: data.linkUrl, // Added linkUrl
                linkText: data.linkText, // Added linkText
                createdAt: data.createdAt?.toDate() || new Date(),
            });
        });
        setNotifications(notifs);
        
        const seenStorage = localStorage.getItem('seenNotificationIds');
        const seenIds = seenStorage ? JSON.parse(seenStorage) : [];
        const hasUnread = notifs.some(n => !seenIds.includes(n.id));

        if (hasUnread) {
            setUnreadNotifications(true);
            // Play sound only if it hasn't been played for this batch of unread notifications
            if (!hasPlayedNotificationSoundRef.current && outputAudioContextRef.current) {
                playNotificationSound(outputAudioContextRef.current);
                hasPlayedNotificationSoundRef.current = true;
            }
        } else {
            setUnreadNotifications(false);
            hasPlayedNotificationSoundRef.current = false; // Reset if no unread notifications
        }
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, []);

  const markNotificationsAsSeen = useCallback(async () => {
      if (!notifications || notifications.length === 0) return;

      const seenStorage = localStorage.getItem('seenNotificationIds');
      const seenIds: string[] = seenStorage ? JSON.parse(seenStorage) : [];
      const newSeenIds = [...seenIds];
      let hasUpdates = false;

      for (const n of notifications) {
          if (!seenIds.includes(n.id)) {
              const notifRef = doc(db, 'system_notifications', n.id);
              try {
                  await updateDoc(notifRef, { viewCount: increment(1) });
              } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `system_notifications/${n.id}`);
              }
              newSeenIds.push(n.id);
              hasUpdates = true;
          }
      }

      if (hasUpdates) {
          localStorage.setItem('seenNotificationIds', JSON.stringify(newSeenIds));
      }
      setUnreadNotifications(false);
      hasPlayedNotificationSoundRef.current = false; // Reset after marking as seen
  }, [notifications]);

  // NEW: FocoFlow Alarms Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'focuflow_items'),
      where('user_id', '==', user.uid),
      where('category', '==', 'reminder')
    );

    const path = 'focuflow_items';
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReminders(fetchedReminders);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  // NEW: Alarm Checker Effect
  useEffect(() => {
    if (!reminders || reminders.length === 0) {
      setRingingAlarms([]);
      return;
    }

    const checkAlarms = () => {
      const now = Date.now();
      const active = (reminders || []).filter((r: any) => {
        // Trigger if reminderTime is reached and not dismissed/completed
        // We allow a window of 1 hour for old alarms to trigger if they weren't dismissed
        const oneHourAgo = now - (60 * 60 * 1000);
        return r.reminderTime <= now && r.reminderTime > oneHourAgo && !r.dismissed && !r.completed;
      });
      
      // Only update if the list of active alarms actually changed to prevent unnecessary re-renders
      setRingingAlarms(prev => {
        const currentPrev = prev || [];
        const prevIds = currentPrev.map(a => a.id).sort().join(',');
        const nextIds = active.map(a => a.id).sort().join(',');
        if (prevIds === nextIds) return currentPrev;
        return active;
      });
    };

    const interval = setInterval(checkAlarms, 1000);
    checkAlarms();

    return () => clearInterval(interval);
  }, [reminders]);

  // NEW: Alarm Sound Effect
  useEffect(() => {
    if (ringingAlarms && ringingAlarms.length > 0) {
      if (!alarmIntervalRef.current) {
        // Ensure AudioContext exists for alarm
        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
            try {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            } catch (e) {
                console.error("Failed to create AudioContext for alarm:", e);
            }
        }

        // Play alarm sound every second
        alarmIntervalRef.current = window.setInterval(() => {
          if (outputAudioContextRef.current) {
            playAlarmSound(outputAudioContextRef.current);
          }
        }, 1000);
      }
    } else {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    }
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, [ringingAlarms]);

  const handleDismissAlarm = useCallback(async (alarmId: string) => {
    try {
        await updateFocoFlowItem(alarmId, { dismissed: true });
        setRingingAlarms(prev => (prev || []).filter(a => a.id !== alarmId));
    } catch (error) {
        console.error("Error dismissing alarm:", error);
    }
  }, []);

  const handleDismissAllAlarms = useCallback(async () => {
    if (!ringingAlarms || ringingAlarms.length === 0) return;
    try {
        const ids = ringingAlarms.map(a => a.id);
        await Promise.all(ids.map(id => updateFocoFlowItem(id, { dismissed: true })));
        setRingingAlarms([]);
    } catch (error) {
        console.error("Error dismissing all alarms:", error);
    }
  }, [ringingAlarms]);

  const handleStopAlarmCommand = useCallback(() => {
      console.log("Stopping alarm via voice command...");
      handleDismissAllAlarms();
  }, [handleDismissAllAlarms]);

  const handleUpdateUserPreferencesCommand = useCallback(async (prefs: { themeColor?: string; assistantName?: string; userName?: string }) => {
      console.log("Updating user preferences via voice command:", prefs);
      if (!user) return;

      const updates: any = {};

      if (prefs.themeColor) {
          setCustomThemeColor(prefs.themeColor);
          updates.customThemeColor = prefs.themeColor;
      }

      if (prefs.assistantName) {
          setChicoCustomName(prefs.assistantName);
          updates.chicoCustomName = prefs.assistantName;
      }

      if (prefs.userName) {
          setUserPreferredName(prefs.userName);
          updates.userPreferredName = prefs.userName;
      }

      if (Object.keys(updates).length > 0) {
          try {
              await updateDoc(doc(db, 'users', user.uid), updates);
          } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
          }
      }
  }, [user]);

  // NEW: Fetch Custom Agents
  useEffect(() => {
      if (!user) return;

      const q = query(
          collection(db, `users/${user.uid}/custom_agents`),
          orderBy('createdAt', 'desc')
      );

      const path = `users/${user.uid}/custom_agents`;
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const agents: CustomAgent[] = [];
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              agents.push({
                  id: doc.id,
                  name: data.name,
                  description: data.description,
                  systemInstruction: data.systemInstruction,
                  createdAt: data.createdAt?.toDate() || new Date(),
              });
          });
          setCustomAgents(agents);
      }, (err) => {
          handleFirestoreError(err, OperationType.GET, path);
      });

      return () => unsubscribe();
  }, [user]);

  // Fetch all conversations for the user
  useEffect(() => {
      if (!user) return;
      setIsConversationsLoading(true);

      const q = query(
          collection(db, 'conversations'),
          where('uid', '==', user.uid)
      );

      const path = 'conversations';
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedConversations: Conversation[] = [];
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              fetchedConversations.push({
                  id: doc.id,
                  uid: data.uid,
                  title: data.title,
                  createdAt: data.createdAt?.toDate() || new Date(),
                  isArchived: data.isArchived || false,
              });
          });
          
          fetchedConversations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          setAllConversations(fetchedConversations);
          
          const currentActive = fetchedConversations.find(c => !c.isArchived);

          if (!activeConversationId && currentActive) {
              setActiveConversationId(currentActive.id);
          }
          
          if (!initialLoadComplete && !currentActive) {
              handleNewChat();
          }
          
          setIsConversationsLoading(false);
          setInitialLoadComplete(true);
      }, (error) => {
          handleFirestoreError(error, OperationType.GET, path);
          setErrorMessage("Não foi possível carregar seu histórico de conversas.");
          setIsConversationsLoading(false);
      });

      return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch messages for the active conversation
  useEffect(() => {
      if (!activeConversationId) {
          setActiveMessages([]);
          return;
      }
      
      // Reset scroll tracking when changing conversations
      shouldAutoScrollRef.current = true;

      setIsMessagesLoading(true);
      const q = query(
          collection(db, `conversations/${activeConversationId}/messages`),
          orderBy('timestamp', 'asc')
      );

      const path = `conversations/${activeConversationId}/messages`;
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedMessages: ConversationMessage[] = [];
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              fetchedMessages.push({
                  id: doc.id,
                  role: data.role,
                  text: data.text,
                  timestamp: data.timestamp?.toDate() || new Date(),
                  summary: data.summary,
                  imageUrl: data.imageUrl,
                  fileName: data.fileName,
                  blockType: data.blockType,
              });
          });
          setActiveMessages(fetchedMessages);
          setIsMessagesLoading(false);
      }, (error) => {
          handleFirestoreError(error, OperationType.GET, path);
          setErrorMessage("Não foi possível carregar as mensagens desta conversa.");
          setIsMessagesLoading(false);
      });

      return () => unsubscribe();
  }, [activeConversationId]);

  // SMART AUTO-SCROLL LOGIC
  const handleChatScroll = useCallback(() => {
      if (chatContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
          // Determine if user is near bottom (within 100px)
          const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
          shouldAutoScrollRef.current = isAtBottom;
      }
  }, []);

  useEffect(() => {
      if (shouldAutoScrollRef.current && chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
  }, [activeMessages, currentInputTranscription, currentOutputTranscription, silencePromptVisible]);


  const handleLogout = async () => {
    try {
      if (user?.email) {
        localStorage.setItem('lastKnownTokenCount', JSON.stringify({ email: user.email, tokens: remainingTokens }));
      }
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error)
    }
  };
  
  const updateUsage = useCallback((tokens: number, cost: number) => {
      if (userApiKey) return;
      setUsageInfo(prev => ({ totalTokens: prev.totalTokens + tokens, totalCost: prev.totalCost + cost }));
      setRemainingTokens(prev => prev - tokens);
      usageUpdateRef.current.tokenDelta += tokens;
      usageUpdateRef.current.costDelta += cost;
      if (firestoreUpdateTimerRef.current) clearTimeout(firestoreUpdateTimerRef.current);
      firestoreUpdateTimerRef.current = window.setTimeout(async () => {
          const { tokenDelta, costDelta } = usageUpdateRef.current;
          if (tokenDelta > 0 || costDelta > 0) {
              const userDocRef = doc(db, 'users', user.uid);
              try {
                  await updateDoc(userDocRef, {
                      'usage.totalTokens': increment(tokenDelta),
                      'usage.totalCost': increment(costDelta),
                      'usage.remainingTokens': increment(-tokenDelta)
                  });
              } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
              }
              usageUpdateRef.current = { tokenDelta: 0, costDelta: 0 };
          }
      }, 3000);
  }, [user.uid, userApiKey]);
  
  const generateAndStoreSummary = useCallback(async (messageId: string, text: string) => {
    if (text.length > TEXT_COMPRESSION_THRESHOLD && activeConversationId) {
        try {
            const summary = await summarizeText(text);
            const messageRef = doc(db, `conversations/${activeConversationId}/messages`, messageId);
            await updateDoc(messageRef, { summary });
        } catch(err) {
            handleFirestoreError(err, OperationType.UPDATE, `conversations/${activeConversationId}/messages/${messageId}`);
        }
    }
  }, [activeConversationId]);
  
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setSilencePromptVisible(false);
  }, [setSilencePromptVisible]); 

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => setSilencePromptVisible(true), 5000);
  }, [clearSilenceTimer, setSilencePromptVisible]); 

  // --- OPTIMIZED VIDEO CAPTURE (Downscaling) ---
  // MOVED UP to be available for stopScreenSharing (indirectly if needed, though logically distinct)
  const captureScreenAsBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current) { resolve(null); return; }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Use alpha: false to optimize canvas performance for video frames
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          // MAX WIDTH 800px for performance optimization
          const MAX_WIDTH = 800;
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          if (width > MAX_WIDTH) {
              const scale = MAX_WIDTH / width;
              width = MAX_WIDTH;
              height = height * scale;
          }

          // Set canvas to downscaled size
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(video, 0, 0, width, height);
          
          // Compress to JPEG 0.6 quality
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.6);
      } else {
        resolve(null);
      }
    });
  }, []);

  // --- DISCONNECT SESSION ---
  // MOVED UP to be available for stopScreenSharing
  const disconnectSession = useCallback(() => {
    setIsMicActive(false);
    if (liveSessionControllerRef.current) {
        liveSessionControllerRef.current.stopMicrophoneInput();
        liveSessionControllerRef.current.closeSession();
        liveSessionControllerRef.current = null;
    }
    // Also force stop videos if full disconnect is called
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsScreenSharing(false);
    setIsCameraActive(false);
    setVisualHelp(null);
    
    playBeep(outputAudioContextRef.current, 300, 150); 
    enviarStatusParaExtensao(false);
  }, []);

  // --- 5-MINUTE SCREEN SHARING INACTIVITY TIMER ---
  const stopScreenSharing = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsScreenSharing(false);
    setVisualHelp(null);

    // Only close the whole session if the microphone is also inactive
    if (!isMicActiveRef.current && liveSessionControllerRef.current) {
        disconnectSession();
    }
  }, [disconnectSession]); 

  const resetInactivityTimer = useCallback(() => {
      // Clear existing timer
      if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
      }
      
      // If screen sharing is active (checked via ref for stability), start a new 5-minute timer
      if (isScreenSharingRef.current) {
           console.log("Inactivity timer reset (5 min)");
           inactivityTimerRef.current = window.setTimeout(() => {
              console.log("Inactivity limit reached. Stopping screen share.");
              stopScreenSharing();
              setErrorMessage("Compartilhamento de tela encerrado automaticamente após 5 minutos de inatividade para economizar recursos.");
          }, 5 * 60 * 1000); // 5 minutes
      }
  }, [stopScreenSharing]);

  // Effect to manage inactivity timer lifecycle based on screen sharing state
  useEffect(() => {
      if (isScreenSharing) {
          resetInactivityTimer();
      } else {
          if (inactivityTimerRef.current) {
              clearTimeout(inactivityTimerRef.current);
              inactivityTimerRef.current = null;
          }
      }
      return () => {
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      };
  }, [isScreenSharing, resetInactivityTimer]);


  // Define handleActivateAgent and handleDeactivateAgent early so they are available for useCallback dependencies and other functions.
  const handleActivateAgent = useCallback((agentId: Agent) => {
    if (agentId === activeAgent) return;
    resetInactivityTimer(); // Interaction detected
    if (isMicActive) {
        // We don't turn off mic here immediately to avoid disrupting the flow
    }
    setActiveAgent(agentId);
    setIsAgentsModalOpen(false);
    
    // Determine name for system message
    let agentName = 'Agente Personalizado';
    const customAgent = customAgents.find(a => a.id === agentId);
    const systemAgent = SYSTEM_AGENTS.find(a => a.id === agentId);

    if (customAgent) {
        agentName = customAgent.name;
    } else if (systemAgent) {
        agentName = systemAgent.name;
    }

    addMessage('system', `Sistema ativou o modo: ${agentName}`);
  }, [activeAgent, customAgents, addMessage, isMicActive, resetInactivityTimer]);

  const handleDeactivateAgent = useCallback(() => {
    if (activeAgent === 'default') return;
    resetInactivityTimer(); // Interaction detected
    setActiveAgent('default');
    setIsAgentsModalOpen(false);
    addMessage('system', 'Sistema ativou o modo: Assistente Padrão');
  }, [activeAgent, addMessage, resetInactivityTimer]);

  const handleCreateCustomAgent = useCallback(async (name: string, desc: string, instr: string) => {
    if(!user) return;
    try {
        await addDoc(collection(db, `users/${user.uid}/custom_agents`), {
            name, description: desc, systemInstruction: instr, createdAt: serverTimestamp()
        });
    } catch(err) { 
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/custom_agents`);
        setErrorMessage("Erro ao criar agente."); 
    }
  }, [user]);

  const handleUpdateCustomAgent = useCallback(async (id: string, name: string, desc: string, instr: string) => {
    if(!user) return;
    try {
        await updateDoc(doc(db, `users/${user.uid}/custom_agents`, id), {
            name, description: desc, systemInstruction: instr
        });
    } catch(err) { 
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/custom_agents/${id}`);
        setErrorMessage("Erro ao atualizar agente."); 
    }
  }, [user]);

  const handleDeleteCustomAgent = useCallback(async (id: string) => {
    if(!user) return;
    // Add confirm logic here properly, simplified for now
    if(confirm("Excluir este agente?")) {
        try {
            await deleteDoc(doc(db, `users/${user.uid}/custom_agents`, id));
            if(activeAgent === id) handleActivateAgent('default');
        } catch(err) { 
            handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/custom_agents/${id}`);
            setErrorMessage("Erro ao excluir agente."); 
        }
    }
  }, [user, activeAgent, handleActivateAgent]);

  const onSwitchAgentCommand = useCallback((agentName: string) => {
      resetInactivityTimer(); // Interaction detected (Voice Command)
      // Normalize string: Lowercase, remove accents
      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedInput = normalize(agentName);

      // 1. Check Custom Agents (Name Matching)
      const customMatch = customAgents.find(a => 
          normalize(a.name).includes(normalizedInput) || normalizedInput.includes(normalize(a.name))
      );
      if (customMatch) {
          handleActivateAgent(customMatch.id);
          return;
      }

      // 2. Check System Agents (Keywords & Name Matching)
      // This allows the AI to send "trafego", "gestor", "andromeda" and we find the right agent
      const systemMatch = SYSTEM_AGENTS.find(a => 
          // Match ID directly
          a.id === agentName ||
          // Match Name partial
          normalize(a.name).includes(normalizedInput) ||
          // Match any defined keyword
          a.keywords.some(k => normalizedInput.includes(k))
      );

      if (systemMatch) {
          handleActivateAgent(systemMatch.id);
          return;
      }

      // Fallback: If "default" or general terms are used but missed above
      if (['padrao', 'normal', 'voltar', 'inicio'].some(k => normalizedInput.includes(k))) {
          handleActivateAgent('default');
      }

  }, [customAgents, handleActivateAgent, resetInactivityTimer]);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
    setVisualHelp(null);

    // Only close the whole session if the microphone is also inactive
    // CRITICAL FIX: Use Ref to check mic status to avoid stale closures in event listeners
    if (!isMicActiveRef.current && liveSessionControllerRef.current) {
        disconnectSession();
    }
  }, [disconnectSession]);

  useEffect(() => {
    // Clear existing interval to avoid duplicates
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // UPDATED LOOP: Send frame if video is active, REGARDLESS of mic state (as long as session exists)
    // We assume the session is open (via toggleMicrophone logic or initial setup)
    if ((isScreenSharing || isCameraActive) && liveSessionControllerRef.current) {
       frameIntervalRef.current = window.setInterval(async () => {
          const blob = await captureScreenAsBlob();
          if (blob) {
              try {
                  const base64Data = await blobToBase64(blob);
                  liveSessionControllerRef.current?.sessionPromise?.then((session) => {
                      session.sendRealtimeInput({ video: { data: base64Data, mimeType: 'image/jpeg' } });
                  });
                  updateUsage(ESTIMATED_TOKENS_PER_IMAGE_FRAME, ESTIMATED_COST_PER_IMAGE_FRAME);
              } catch (e) { console.error("Error sending frame:", e); }
          }
       }, 1000); 
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isMicActive, isScreenSharing, isCameraActive, updateUsage, captureScreenAsBlob]);

  const startScreenSharing = useCallback(async (): Promise<boolean> => {
    try {
      if (isCameraActive) {
          // Stop camera but don't disconnect session
          if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => track.stop());
            cameraStreamRef.current = null;
          }
          setIsCameraActive(false);
          await new Promise(r => setTimeout(r, 100));
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };
      
      setIsScreenSharing(true);
      return true;
    } catch (err: any) {
      console.warn('Screen sharing failed or cancelled:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorName = err instanceof Error ? err.name : '';

      if (
        errorName === 'NotAllowedError' || 
        errorName === 'AbortError' ||
        errorMsg.includes('Permission denied') ||
        errorMsg.includes('user denied') ||
        errorMsg.includes('User denied')
      ) {
        return false;
      }

      setErrorMessage("Falha ao iniciar o compartilhamento de tela.");
      return false;
    }
  }, [stopScreenSharing, isCameraActive]); // Removed stopCamera dep as we inline simplified logic to avoid recursion

  const startCamera = useCallback(async (): Promise<boolean> => {
      try {
        if (isScreenSharing) {
            // Stop screen but don't disconnect session
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
            }
            setIsScreenSharing(false);
            await new Promise(r => setTimeout(r, 100));
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        cameraStreamRef.current = stream;
        stream.getVideoTracks()[0].onended = () => {
            stopCamera();
        };

        setIsCameraActive(true);
        return true;
      } catch (err: any) {
          console.warn('Camera start failed or cancelled:', err);
          const errorMsg = err instanceof Error ? err.message : String(err);
          const errorName = err instanceof Error ? err.name : '';

          if (
            errorName === 'NotAllowedError' || 
            errorName === 'NotFoundError' || 
            errorName === 'AbortError' ||
            errorMsg.includes('Permission denied') ||
            errorMsg.includes('user denied')
          ) {
             if (errorName === 'NotFoundError') {
                setErrorMessage("Nenhuma câmera encontrada no dispositivo.");
             }
             return false;
          }

          setErrorMessage(`Falha ao iniciar a câmera: ${errorMsg}`);
          return false;
      }
  }, [stopCamera, isScreenSharing]);
  
  const handleNewChat = async () => {
    // If we have a session, close it entirely when starting new chat
    if(liveSessionControllerRef.current) {
        disconnectSession();
    }
    
    try {
        const newConvoRef = await addDoc(collection(db, 'conversations'), {
            uid: user.uid,
            title: "Nova Conversa",
            createdAt: serverTimestamp(),
            isArchived: false,
        });

        await addDoc(collection(db, `conversations/${newConvoRef.id}/messages`), {
            role: 'system',
            text: 'Olá, eu sou o Chico IA. Posso ver o que você vê (tela ou câmera) e te guiar. Faça uma pergunta por texto ou ative o microfone para conversar.',
            timestamp: serverTimestamp(),
        });

        setActiveConversationId(newConvoRef.id);
        setTextInput('');
        setCurrentInputTranscription('');
        setCurrentOutputTranscription('');
        setErrorMessage(null);
    } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'conversations');
        setErrorMessage("Falha ao criar nova conversa.");
    }
  };
  
  const handleArchiveConversation = async (conversationId: string) => {
    try {
        const conversationDocRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationDocRef, { isArchived: true });

        if (activeConversationId === conversationId) {
            const nextActiveConvo = activeConversations.find(c => c.id !== conversationId);
            if (nextActiveConvo) {
                setActiveConversationId(nextActiveConvo.id);
            } else {
                handleNewChat();
            }
        }
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`);
        setErrorMessage("Não foi possível arquivar a conversa.");
    }
  };
  
  const handleRestoreConversation = async (conversationId: string) => {
      try {
          const conversationDocRef = doc(db, 'conversations', conversationId);
          await updateDoc(conversationDocRef, { isArchived: false, createdAt: serverTimestamp() });
          setActiveConversationId(conversationId);
          setIsArchivedModalOpen(false); // Close the archived modal after restoring
      } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`);
          setErrorMessage("Não foi possível restaurar a conversa.");
      }
  };

  const handleDeleteConversation = async () => {
    if (!chatToDelete) return;
    try {
      const messagesQuery = query(collection(db, `conversations/${chatToDelete.id}/messages`));
      const querySnapshot = await getDocs(messagesQuery);
      for (const doc of querySnapshot.docs) {
          try {
              await deleteDoc(doc.ref);
          } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, doc.ref.path);
          }
      }

      await deleteDoc(doc(db, 'conversations', chatToDelete.id));

      if (activeConversationId === chatToDelete.id) {
          const nextActiveConvo = activeConversations.find(c => c.id !== chatToDelete.id) || activeConversations[0] || null;
          if (nextActiveConvo) {
              setActiveConversationId(nextActiveConvo.id);
          } else {
              handleNewChat();
          }
      }
      setChatToDelete(null); 
    } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `conversations/${chatToDelete.id}`);
        setErrorMessage("Não foi possível excluir a conversa.");
        setChatToDelete(null); 
    }
  };
  
  const startEditingConversation = (convo: Conversation) => {
    setEditingConversationId(convo.id);
    setEditTitleInput(convo.title);
  };

  const saveConversationTitle = async (convoId: string) => {
    if (!editTitleInput.trim() || editTitleInput === "") {
         setEditingConversationId(null);
         return;
    }
    try {
        await updateDoc(doc(db, 'conversations', convoId), { title: editTitleInput.trim() });
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `conversations/${convoId}`);
        setErrorMessage("Erro ao atualizar o título.");
    } finally {
        setEditingConversationId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, convoId: string) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveConversationTitle(convoId);
    } else if (e.key === 'Escape') {
        setEditingConversationId(null);
    }
  };

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        if (!response.ok) throw new Error('Failed to fetch exchange rate');
        const data = await response.json();
        const rate = parseFloat(data.USDBRL.bid);
        setUsdToBrlRate(rate);
      } catch (error) {
        console.error("Could not fetch USD to BRL exchange rate:", error);
      }
    };
    fetchExchangeRate();
    inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
    outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
    
    // Setup Audio Analyser for Visualizer
    const analyser = outputAudioContextRef.current.createAnalyser();
    analyser.fftSize = 256; // Increased from 64 for better wave resolution
    analyser.smoothingTimeConstant = 0.5;
    analyser.connect(outputAudioContextRef.current.destination);
    audioAnalyserRef.current = analyser;

    // Galaxy Animation State
    let time = 0;
    const numStars = 400;
    const stars: {x: number, y: number, z: number, radius: number, angle: number, speed: number, color: string, dist: number}[] = [];
    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: 0,
            y: 0,
            z: Math.random() * 2,
            radius: Math.random() * 1.5 + 0.5,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.01 + 0.002,
            color: `hsl(${Math.random() * 40 + 190}, 100%, ${Math.random() * 40 + 60}%)`, // Cyan/Blue colors
            dist: Math.random() * 400 + 50
        });
    }

    // Start Visualizer Loop
    // Throttle para ~30fps + respeito a prefers-reduced-motion. A animacao e
    // decorativa; isso reduz pela metade o custo de CPU/GPU (e bateria no mobile).
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    const FRAME_INTERVAL_MS = 1000 / 30;
    let lastDrawTs = 0;
    const renderVisualizer = (now: number = 0) => {
        // Reagenda sempre no topo (ponto unico de agendamento).
        animationFrameRef.current = requestAnimationFrame(renderVisualizer);

        // Cap de frame-rate: ignora frames antes do intervalo alvo.
        if (now - lastDrawTs < FRAME_INTERVAL_MS) return;
        lastDrawTs = now;

        // Usuario pediu menos movimento: nao desenha a animacao continua.
        if (prefersReducedMotion) return;

        const smallCanvas = visualizerCanvasRef.current;
        const immersiveCanvas = immersiveCanvasRef.current;

        if (!audioAnalyserRef.current) {
             return;
        }
        
        const bufferLength = audioAnalyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyserRef.current.getByteFrequencyData(dataArray);
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary') || '#00B7FF';

        // 1. Draw Small Canvas (Standard Mode - Below Text Input)
        if (smallCanvas) {
            const ctx = smallCanvas.getContext('2d');
            if (ctx) {
                // Resize handling inside loop to match container width
                const parentWidth = smallCanvas.parentElement?.clientWidth || 300;
                if (smallCanvas.width !== parentWidth) {
                    smallCanvas.width = parentWidth;
                }
                
                ctx.clearRect(0, 0, smallCanvas.width, smallCanvas.height);
                const centerX = smallCanvas.width / 2;
                const barWidth = 3;
                const gap = 2;
                const barsToDraw = Math.floor(smallCanvas.width / 2 / (barWidth + gap)); 
                
                // Draw mirrored bars from center
                for (let i = 0; i < barsToDraw; i++) {
                    const value = dataArray[i % bufferLength]; // Wrap around data if bars > buffer
                    const percent = value / 255;
                    const height = Math.max(2, percent * smallCanvas.height * 0.9);
                    
                    ctx.fillStyle = accentColor;
                    ctx.globalAlpha = 0.5 + (percent * 0.5); 
                    
                    // Draw right side
                    ctx.fillRect(centerX + (i * (barWidth + gap)), (smallCanvas.height - height) / 2, barWidth, height);
                    // Draw left side (mirrored)
                    if (i > 0) ctx.fillRect(centerX - (i * (barWidth + gap)), (smallCanvas.height - height) / 2, barWidth, height);
                }
            }
        }

        // 2. Draw Immersive Canvas (Futuristic Sphere/Ball with Rays)
        if (isImmersiveModeRef.current && immersiveCanvas) {
            const ctx = immersiveCanvas.getContext('2d');
            if (ctx) {
                // Resize handling
                immersiveCanvas.width = window.innerWidth;
                immersiveCanvas.height = window.innerHeight;
                const centerX = immersiveCanvas.width / 2;
                const centerY = immersiveCanvas.height / 2;

                ctx.clearRect(0, 0, immersiveCanvas.width, immersiveCanvas.height);
                
                // --- GALAXY/UNIVERSE ANIMATION ---
                // Calculate average volume for pulse effect
                let sum = 0;
                for(let i=0; i<bufferLength; i++) sum += dataArray[i];
                const avg = sum / bufferLength;
                const audioPulse = avg / 255; // 0 to 1
                
                // Background
                ctx.fillStyle = 'rgba(10, 15, 30, 0.3)'; // Dark space background with trail effect
                ctx.fillRect(0, 0, immersiveCanvas.width, immersiveCanvas.height);
                
                time += 1;
                
                // Draw Stars (Galaxy)
                ctx.save();
                ctx.translate(centerX, centerY);
                
                // Rotate entire galaxy slowly, speed up with audio
                ctx.rotate(time * (0.001 + audioPulse * 0.005));

                stars.forEach((star, index) => {
                    // Update star angle
                    star.angle += star.speed * (1 + audioPulse * 5);
                    
                    // Calculate position with spiral effect
                    const spiralFactor = 1 + (star.dist / 500);
                    const currentDist = star.dist + Math.sin(time * 0.05 + index) * 5 + (audioPulse * star.dist * 0.2);
                    
                    star.x = Math.cos(star.angle * spiralFactor) * currentDist;
                    star.y = Math.sin(star.angle * spiralFactor) * currentDist;
                    
                    // Draw star
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.radius * (1 + audioPulse * 2), 0, Math.PI * 2);
                    ctx.fillStyle = star.color;
                    ctx.globalAlpha = 0.6 + (audioPulse * 0.4);
                    ctx.fill();
                    
                    // Add glow to some stars
                    if (index % 10 === 0) {
                        ctx.shadowBlur = 10 + (audioPulse * 20);
                        ctx.shadowColor = star.color;
                        ctx.fill();
                        ctx.shadowBlur = 0; // Reset
                    }
                });
                
                // Draw Central Core (J.A.R.V.I.S. Eye)
                const coreRadius = 40 + (audioPulse * 30);
                
                // Core Glow
                const gradient = ctx.createRadialGradient(0, 0, coreRadius * 0.2, 0, 0, coreRadius * 2);
                gradient.addColorStop(0, 'rgba(150, 220, 255, 1)');
                gradient.addColorStop(0.3, 'rgba(0, 150, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(0, 50, 150, 0)');
                
                ctx.fillStyle = gradient;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(0, 0, coreRadius * 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Core Ring
                ctx.strokeStyle = `rgba(100, 200, 255, ${0.5 + audioPulse * 0.5})`;
                ctx.lineWidth = 2 + (audioPulse * 4);
                ctx.beginPath();
                ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
                ctx.stroke();
                
                // Inner Rings reacting to frequency
                const ringCount = 3;
                for (let i = 0; i < ringCount; i++) {
                    const freqValue = dataArray[Math.floor((i / ringCount) * bufferLength)] / 255;
                    ctx.strokeStyle = `rgba(200, 240, 255, ${0.3 + freqValue * 0.7})`;
                    ctx.lineWidth = 1 + freqValue * 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, coreRadius * (0.4 + (i * 0.2)) + (freqValue * 15), 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                ctx.restore();
            }
        }
    };
    renderVisualizer();

    return () => {
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      window.speechSynthesis.cancel();
      clearSilenceTimer();
      stopScreenSharing(); 
      stopCamera(); 
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed isImmersiveMode dependency to prevent audio context recreation

  // Restart session when immersive mode changes to update voice
  useEffect(() => {
      if (isMicActive) {
          disconnectSession();
          setTimeout(() => handleToggleMicrophone(true), 500);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImmersiveMode]);

  // NEW: Speak Text Function for TTS in Chat
  const speakText = (text: string) => {
    if (!text) return;
    
    // Clean up markdown/code blocks for speech
    let cleanText = text.replace(/<codeblock>[\s\S]*?<\/codeblock>/g, ' Código oculto. ');
    cleanText = cleanText.replace(/```[\s\S]*?```/g, ' Bloco de código. ');
    cleanText = cleanText.replace(/\*/g, ''); // Remove bold/italic markers
    cleanText = cleanText.replace(/<[^>]*>/g, ''); // Remove tags like <highlight>
    
    // Stop previous utterance
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9; // Slightly slower natural speaking rate
    
    // Optional: Select a specific voice if available (browser dependent)
    // const voices = window.speechSynthesis.getVoices();
    // const ptVoice = voices.find(v => v.lang.includes('pt-BR'));
    // if (ptVoice) utterance.voice = ptVoice;
    
    window.speechSynthesis.speak(utterance);
  };
  
  const handleModelResponse = useCallback(async (responseText: string, isUserCopyRequest: boolean = false) => {
      console.log("handleModelResponse: Processing response:", responseText.substring(0, 100) + "...");
      const codeBlockRegex = /<codeblock>(.*?)<\/codeblock>/s;
      const highlightRegex = /<highlight>([\s\S]*?)<\/highlight>/i;
      const switchAgentRegex = /\[\[SWITCH_AGENT:(.*?)\]\]/i;
      const setUserNameRegex = /\[\[SET_USER_NAME:(.*?)\]\]/i;

      const userNameMatch = responseText.match(setUserNameRegex);
      if (userNameMatch && userNameMatch[1]) {
          const newName = userNameMatch[1].trim();
          setUserPreferredName(newName);
          if (user) {
              try {
                  await updateDoc(doc(db, 'users', user.uid), { userPreferredName: newName });
              } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
              }
          }
      }

      const switchMatch = responseText.match(switchAgentRegex);
      if (switchMatch && switchMatch[1]) {
          const agentName = switchMatch[1].trim();
          console.log("Switching agent via text tag:", agentName);
          onSwitchAgentCommand(agentName);
      }

      let modelTextWithoutSwitch = responseText.replace(switchAgentRegex, '').replace(setUserNameRegex, '').trim();

      const highlightMatch = modelTextWithoutSwitch.match(highlightRegex);
      if (highlightMatch && highlightMatch[1]) {
          try {
              let jsonStr = highlightMatch[1].trim();
              jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
              
              const coords = JSON.parse(jsonStr);
              if (typeof coords.x === 'number' && typeof coords.y === 'number') {
                  if (isScreenSharing || isCameraActive) {
                      const blob = await captureScreenAsBlob();
                      if (blob) {
                          const newImageUrl = await blobToDataURL(blob);
                          setVisualHelp({ image: newImageUrl, highlight: coords });
                      }
                  } else {
                      const lastUserImage = activeMessages.slice().reverse().find(m => m.role === 'user' && m.imageUrl)?.imageUrl;
                      if (lastUserImage) {
                          setVisualHelp({ image: lastUserImage, highlight: coords });
                      }
                  }
              }
          } catch (e) {
              console.error("Failed to parse highlight coordinates:", e);
          }
      }

      let modelTextWithoutHighlight = modelTextWithoutSwitch.replace(highlightRegex, '').trim();
      let explanationText = '';
      let codeText: string | undefined;
      let copyableBlockText: string | undefined; 

      const codeMatch = modelTextWithoutHighlight.match(codeBlockRegex);

      if (codeMatch && codeMatch[1]) {
          codeText = codeMatch[1].trim();
          explanationText = modelTextWithoutHighlight.replace(codeBlockRegex, '').trim();
      } else {
          explanationText = modelTextWithoutHighlight;
      }
      
      if (isUserCopyRequest && !codeText && (explanationText || '').length < 500) {
          copyableBlockText = explanationText;
      }

      const messageId = await addMessage('model', modelTextWithoutHighlight, { 
          blockType: codeText ? 'code' : copyableBlockText ? 'text' : undefined
      });
      
      if (messageId && (explanationText || '').length > TEXT_COMPRESSION_THRESHOLD) {
          generateAndStoreSummary(messageId, explanationText);
      }
  }, [addMessage, generateAndStoreSummary, activeMessages, isScreenSharing, isCameraActive, captureScreenAsBlob, onSwitchAgentCommand]);
  
  const onModelStartSpeaking = useCallback(() => {
    setIsSpeaking(true);
    startSilenceTimer();
  }, [startSilenceTimer]);

  const onModelStopSpeaking = useCallback((text: string) => {
    setIsSpeaking(false);
    clearSilenceTimer();
    if (lastProcessedResponseRef.current === text) {
        console.log("Duplicate response ignored.");
        return;
    }
    lastProcessedResponseRef.current = text;
    handleModelResponse(text);
  }, [clearSilenceTimer, handleModelResponse]);

  const onUserStopSpeaking = useCallback((text: string) => {
      lastProcessedResponseRef.current = ''; 
      resetInactivityTimer(); // Interaction detected
      addMessage('user', text);
      checkAndSaveProgrammingLevel(text);
      shouldAutoScrollRef.current = true; // User spoke, ensure auto-scroll is on

      const lowerText = text.toLowerCase();
      const visualKeywords = ['print', 'captura', 'foto', 'mostre', 'onde', 'marcar', 'cadê', 'veja'];
      
      if ((isScreenSharing || isCameraActive) && visualKeywords.some(kw => lowerText.includes(kw))) {
         // Placeholder for client-side visual triggers if needed, currently empty as per requirement
      }
  }, [addMessage, checkAndSaveProgrammingLevel, isScreenSharing, isCameraActive, resetInactivityTimer]);

  const handleToggleMicrophone = async (skipCheck = false) => {
    // If mic is active and we want to turn it off
    if (isMicActive && !skipCheck) {
      // 1. Set State
      setIsMicActive(false);
      resetInactivityTimer(); // Manual Interaction
      
      // 2. Stop Audio Input only
      if (liveSessionControllerRef.current) {
          liveSessionControllerRef.current.stopMicrophoneInput();
      }
      
      // 3. Play Feedback
      playBeep(outputAudioContextRef.current, 300, 150);
      enviarStatusParaExtensao(false);

      // 4. IMPORTANT: Only close the full session if NO video is active
      if (!isScreenSharing && !isCameraActive) {
          disconnectSession();
      } else {
          // If video is active, we KEEP the session open so the model can still see
          console.log("Mic muted, but video active. Session remains open.");
      }

    } else {
      // If mic is inactive and we want to turn it ON
      setIsMicLoading(true);
      resetInactivityTimer(); // Manual Interaction
      try {
        // HARD RESET AUDIO CLOCK: Fixes the bug where audio stops playing after a glitch
        nextStartTimeRef.current = 0;

        // Ensure AudioContexts are healthy. If they were closed/suspended/glitched, recover them.
        const ensureContext = (ref: React.MutableRefObject<AudioContext | null>, sampleRate: number) => {
            if (!ref.current || ref.current.state === 'closed') {
                if (ref.current) {
                    try { ref.current.close(); } catch(e) {}
                }
                ref.current = new AudioContext({ sampleRate });
                return true;
            }
            return false;
        };

        const inputRecreated = ensureContext(inputAudioContextRef, 16000);
        const outputRecreated = ensureContext(outputAudioContextRef, 24000);

        if (outputRecreated && outputAudioContextRef.current) {
            // Reconnect analyser if output was recreated
            const analyser = outputAudioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;
            analyser.connect(outputAudioContextRef.current.destination);
            audioAnalyserRef.current = analyser;
        }

        await outputAudioContextRef.current?.resume();
        await inputAudioContextRef.current?.resume();

        // Second check: if still not running, force recreation
        if (outputAudioContextRef.current?.state !== 'running' || inputAudioContextRef.current?.state !== 'running') {
            console.warn("AudioContexts failed to resume. Forcing recreation...");
            if (inputAudioContextRef.current) try { inputAudioContextRef.current.close(); } catch(e) {}
            if (outputAudioContextRef.current) try { outputAudioContextRef.current.close(); } catch(e) {}
            
            inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
            
            const analyser = outputAudioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;
            analyser.connect(outputAudioContextRef.current.destination);
            audioAnalyserRef.current = analyser;
            
            await outputAudioContextRef.current.resume();
            await inputAudioContextRef.current.resume();
        }

        window.speechSynthesis.cancel(); 

        // CHECK: If session already exists (because video was running), just resume mic
        if (liveSessionControllerRef.current) {
             console.log("Session exists, resuming microphone input...");
             // Clear any old audio buffers to prevent stutter
             liveSessionControllerRef.current.stopPlayback();
             
             await liveSessionControllerRef.current.startMicrophone();
             setIsMicActive(true);
             setIsMicLoading(false);
             playBeep(outputAudioContextRef.current, 600, 150); 
             enviarStatusParaExtensao(true);
             return;
        }

        // If no session exists, create a new one
        let agentInstruction = "";
        const customAgent = customAgents.find(a => a.id === activeAgent);
        if (customAgent) {
            agentInstruction = `\n\n${customAgent.systemInstruction}`;
        }
        
        let finalVoiceName = voiceName;
        if (isImmersiveMode) {
            finalVoiceName = 'Charon'; // J.A.R.V.I.S. like voice
            agentInstruction += "\n\nVocê está no modo imersivo. Aja e fale como J.A.R.V.I.S., a inteligência artificial do Homem de Ferro. Seja extremamente educado, formal, prestativo e use um tom britânico e sofisticado. Responda de forma concisa e direta.";
        }

        const controller = createLiveSession(
            {
                onOpen: () => {
                    setIsMicActive(true);
                    setIsMicLoading(false);
                    playBeep(outputAudioContextRef.current, 600, 150); 
                    enviarStatusParaExtensao(true);
                },
                onClose: () => {
                    console.log("Session closed by server/callback");
                    
                    // Clean up reference immediately so we don't try to reuse a dead session
                    const wasController = liveSessionControllerRef.current;
                    liveSessionControllerRef.current = null;

                    // AUTO-RECONNECT: If mic was supposedly active, restart it.
                    if (isMicActiveRef.current) {
                         console.log("Auto-reconnecting session due to unexpected closure...");
                         // Small delay to prevent tight loop
                         setTimeout(() => handleToggleMicrophone(true), 500);
                    } else {
                        // Normal closure
                        setIsMicActive(false);
                        setIsMicLoading(false);
                        enviarStatusParaExtensao(false);
                    }
                },
                onError: (e) => {
                    console.error("Live Session Error:", e);
                    
                    // Clean up reference immediately
                    const wasController = liveSessionControllerRef.current;
                    liveSessionControllerRef.current = null;
                    
                    // AUTO-RECOVERY LOGIC
                    // Instead of just turning off, try to restart if it was active
                    if (isMicActiveRef.current) {
                        console.warn("Attempting auto-recovery of audio session...");
                        // Disconnect first to clear state
                        if(wasController) {
                            try { wasController.closeSession(); } catch(e){}
                        }
                        // Retry after short delay
                        setTimeout(() => handleToggleMicrophone(true), 1000);
                        return;
                    }

                    setIsMicActive(false);
                    setIsMicLoading(false);
                    enviarStatusParaExtensao(false);
                    
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    if (errorMsg.includes("Requested entity was not found")) {
                        setErrorMessage("Erro de conexão: Entidade não encontrada. Tente selecionar outra chave de API ou reiniciar a sessão.");
                    } else if (errorMsg.includes("503") || errorMsg.includes("unavailable")) {
                         setErrorMessage("O serviço de voz está temporariamente indisponível (Erro 503). Por favor, tente novamente em alguns instantes.");
                    } else {
                        setErrorMessage(`Erro na sessão de voz: ${errorMsg}`);
                    }
                },
                onInputTranscriptionUpdate: (text) => setCurrentInputTranscription(text),
                onOutputTranscriptionUpdate: (text) => setCurrentOutputTranscription(text),
                onModelStartSpeaking: onModelStartSpeaking,
                onModelStopSpeaking: onModelStopSpeaking,
                onUserStopSpeaking: onUserStopSpeaking,
                onTurnComplete: () => { /* Handled in individual callbacks */ },
                onInterrupt: () => { setIsSpeaking(false); clearSilenceTimer(); },
                onDeactivateMicrophoneCommand: () => handleToggleMicrophone(),
                onDeactivateScreenSharingCommand: () => stopScreenSharing(),
                onActivateScreenSharingCommand: () => startScreenSharing(),
                onActivateCameraCommand: () => startCamera(),
                onDeactivateCameraCommand: () => stopCamera(),
                onSwitchAgentCommand: onSwitchAgentCommand,
                onFocoFlowCommand: async (command, args) => {
                    const res = await handleFocoFlowCommand(command, args);
                    if (res.success) {
                        if (res.report) {
                            const reportData = { category: 'financial_report', ...res.report };
                            addMessage('system', `Aqui está o seu relatório financeiro:\n[[FOCOFLOW_ITEM:${JSON.stringify(reportData)}]]`);
                        } else if (res.data && Array.isArray(res.data)) {
                             const items = res.data.map((item: any) => `[[FOCOFLOW_ITEM:${JSON.stringify(item)}]]`).join('\n');
                             addMessage('system', `Aqui estão os dados solicitados:\n${items}`);
                        }
                    }
                    return res;
                },
                onSearchPastConversationsCommand: handleSearchPastConversationsCommand,
                onStopAlarmCommand: handleStopAlarmCommand,
                onUpdateUserPreferencesCommand: handleUpdateUserPreferencesCommand,
                onExternalIntegrationCommand: handleExternalIntegrationCommand,
                onRpaCommand: handleRpaCommand,
                onWebCommand: handleWebCommand,
                onSkyvernCommand: handleSkyvernCommand,
                onSessionReady: (session) => { /* Ready */ },
                onAudioInputActivity: () => { lastMicActivityRef.current = Date.now(); }
            },
            inputAudioContextRef.current!,
            outputAudioContextRef.current!,
            nextStartTimeRef,
            micStreamRef,
            audioAnalyserRef.current, // Pass the analyser
            activeMessages, 
            activeAgent,
            isScreenSharing || isCameraActive,
            initialUserData.programmingLevel,
            agentInstruction,
            finalVoiceName,
            isSummarizedMode,
            chicoCustomName,
            userPreferredName,
            integrations
        );

        liveSessionControllerRef.current = controller;
        await controller.startMicrophone();

      } catch (error) {
          console.error("Failed to start microphone:", error);
          setErrorMessage("Não foi possível acessar o microfone.");
          setIsMicLoading(false);
          setIsMicActive(false);
      }
    }
  };

  const handleSend = async (overrideText?: string) => {
      const messageText = overrideText || textInput;
      if (!messageText.trim() || isSendingText) return;

      setIsSendingText(true);
      resetInactivityTimer(); // Interaction detected
      if (!overrideText) setTextInput('');
      shouldAutoScrollRef.current = true; // Force scroll to bottom on send
      
      // NOTE: We do NOT disconnect mic on text send anymore, to allow concurrent usage if desired,
      // or at least keep the session for video.
      // if (isMicActive) handleToggleMicrophone();
      
      window.speechSynthesis.cancel(); // Stop current speech if typing

      await addMessage('user', messageText);
      checkAndSaveProgrammingLevel(messageText);

      let fileData = undefined;
      const fileInput = attachmentFileInputRef.current;
      if (fileInput && fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          try {
              const base64 = await blobToBase64(file);
              fileData = { base64, mimeType: file.type };
              await addMessage('user', 'Enviou uma imagem.', { imageUrl: `data:${file.type};base64,${base64}` });
          } catch (e) {
              console.error("File read error:", e);
          }
          fileInput.value = ''; 
      }

      if (!fileData && (isScreenSharing || isCameraActive)) {
          const blob = await captureScreenAsBlob();
          if (blob) {
               const base64 = await blobToBase64(blob);
               fileData = { base64, mimeType: 'image/jpeg' };
          }
      }
      
      try {
          let agentInstruction = "";
          const customAgent = customAgents.find(a => a.id === activeAgent);
          if (customAgent) agentInstruction = customAgent.systemInstruction;
          
          console.log("handleSend: Sending message:", messageText, "with history:", activeMessages.length, "messages");
          const result = await sendTextMessage(
              messageText, 
              activeMessages, 
              activeAgent, 
              fileData, 
              isScreenSharing || isCameraActive,
              initialUserData.programmingLevel,
              agentInstruction,
              isSummarizedMode,
              chicoCustomName,
              userPreferredName,
              integrations
          );
          console.log("handleSend: Received result:", result);
          
          if (result && result.functionCalls) {
              for (const fc of result.functionCalls) {
                  if (fc.name === 'switchActiveAgent') {
                      onSwitchAgentCommand((fc.args as any).agentName);
                  } else if (fc.name === 'searchPastConversations') {
                      const res = await handleSearchPastConversationsCommand((fc.args as any).query, (fc.args as any).limit);
                      addMessage('system', res.result || res.error);
                  } else if (fc.name.includes('FocoFlow')) {
                      const res = await handleFocoFlowCommand(fc.name, fc.args);
                      if (res.success) {
                          if (res.report) {
                              const reportData = { category: 'financial_report', ...res.report };
                              addMessage('system', `Aqui está o seu relatório financeiro:\n[[FOCOFLOW_ITEM:${JSON.stringify(reportData)}]]`);
                          } else if (res.data && Array.isArray(res.data)) {
                              const items = res.data.map((item: any) => `[[FOCOFLOW_ITEM:${JSON.stringify(item)}]]`).join('\n');
                              addMessage('system', `Aqui estão os dados solicitados:\n${items}`);
                          } else {
                              addMessage('system', res.message || "Ação do FocoFlow concluída.");
                          }
                      } else {
                          setErrorMessage(res.error || "Erro ao executar comando no FocoFlow.");
                      }
                  } else if (fc.name === 'callOpenClaw' || fc.name === 'callOllama' || fc.name === 'callClaudeCode') {
                      const res = await handleExternalIntegrationCommand(fc.name, fc.args);
                      addMessage('system', `Resposta de ${fc.name.replace('call', '')}:\n${res.result || res.error}`);
                  } else if (fc.name === 'openBrowser' || fc.name === 'navigateBrowser' || fc.name === 'closeBrowser' || fc.name === 'runRpaWorkflow' || fc.name === 'generateAndRunRpa' || fc.name === 'inspectBrowserPage' || fc.name === 'interactWithBrowser' || fc.name === 'scrollPage' || fc.name === 'hoverElement' || fc.name === 'waitForElement' || fc.name === 'getSystemFlows') {
                      const res = await handleRpaCommand(fc.name, fc.args);
                      addMessage('system', res.message || res.error || "Ação RPA concluída.");
                  } else if (fc.name === 'ler_pagina' || fc.name === 'pesquisar' || fc.name === 'extrair') {
                      const res = await handleWebCommand(fc.name, fc.args);
                      addMessage('system', res.message || 'Ação web concluída.');
                  } else if (fc.name === 'tarefa_autonoma') {
                      const res = await handleSkyvernCommand(fc.args);
                      addMessage('system', res.message || 'Tarefa autônoma concluída.');
                  } else if (fc.name === 'transcrever_imagem') {
                      const res = await handleTranscribeImageCommand(fileData);
                      addMessage('system', res.message || 'Transcrição concluída.');
                  } else if (fc.name === 'calculate') {
                      const res = await handleCalculateCommand((fc.args as any).expression);
                      addMessage('system', `Resultado do cálculo: ${res.result || res.error}`);
                  }
              }
          }

          if (result && result.groundingMetadata) {
              const chunks = result.groundingMetadata.groundingChunks;
              if (chunks && chunks.length > 0) {
                  const urls = chunks
                      .filter((c: any) => c.web && c.web.uri)
                      .map((c: any) => `• [${c.web.title || 'Fonte'}](${c.web.uri})`);
                  
                  if (urls.length > 0) {
                      addMessage('system', `Fontes da busca:\n${urls.join('\n')}`);
                  }
              }
          }

          if (result && result.text) {
              await handleModelResponse(result.text, messageText.toLowerCase().includes("copie") || messageText.toLowerCase().includes("copy"));
              
              // NEW: If Text-to-Speech is enabled, speak the response
              if (isTextToSpeechEnabled) {
                  speakText(result.text);
              }

              const inputLen = messageText.length + (fileData ? 1000 : 0);
              const outputLen = (result.text || '').length;
              updateUsage(
                  Math.ceil(inputLen / 4) + Math.ceil(outputLen / 4), 
                  (inputLen / 4 * COST_PER_INPUT_TOKEN) + (outputLen / 4 * COST_PER_OUTPUT_TOKEN)
              );
          }
      } catch (e: any) {
          console.error("Text Gen Error:", e);
          let errText = e.message || String(e);
          
          // Enhanced error parsing for 429/Quota issues
          try {
             if (typeof errText === 'string' && errText.includes('{"error":')) {
                 const parsed = JSON.parse(errText);
                 if(parsed.error?.status === 'RESOURCE_EXHAUSTED' || parsed.error?.code === 429) {
                     errText = "Limite de uso atingido (Cota esgotada). Por favor, aguarde alguns segundos e tente novamente.";
                 } else if (parsed.error?.message) {
                     errText = parsed.error.message;
                 }
             }
          } catch(parseErr) { /* ignore parsing errors */ }

          if(errText.includes("RESOURCE_EXHAUSTED") || errText.includes("429")) {
               errText = "Limite de requisições excedido temporariamente. Aguarde alguns segundos.";
          }

          setErrorMessage(`Erro ao enviar mensagem: ${errText}`);
      } finally {
          setIsSendingText(false);
      }
  };

  const handleToggleTextToSpeech = async () => {
      resetInactivityTimer(); // Interaction detected
      const newState = !isTextToSpeechEnabled;
      setIsTextToSpeechEnabled(newState);
      // Cancel current speech if turning off
      if (!newState) {
          window.speechSynthesis.cancel();
      }
      try {
          await updateDoc(doc(db, 'users', user.uid), { textToSpeechEnabled: newState });
      } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
  };


  return (
    <div className={`flex h-[100dvh] w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* Alarm Overlay */}
      {ringingAlarms && ringingAlarms.length > 0 && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-red-600/40 backdrop-blur-xl animate-pulse-red"
          style={{ animation: 'pulse-red 2s infinite' }}
        >
          <div 
            className="bg-[var(--bg-secondary)] rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.5)] p-8 border-4 border-red-500 max-w-sm w-full text-center animate-shake relative z-[210]"
          >
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">ALERTA FOCO FLOW!</h2>
            <div className="space-y-4 mb-8 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
              {ringingAlarms.map(alarm => (
                <div key={alarm.id} className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                  <p className="text-lg font-bold text-white">{alarm.title}</p>
                  <p className="text-sm text-red-200">{new Date(alarm.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDismissAllAlarms();
              }}
              className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-95 text-xl uppercase tracking-wider"
            >
              SILENCIAR ALARME
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Sidebar - Removed to gain space as requested */}
      
      {/* IMMERSIVE MODE OVERLAY */}
      {isImmersiveMode && (
         <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col items-center justify-center animate-fade-in">
             {/* Exit Button */}
             <button
                 onClick={() => setIsImmersiveMode(false)}
                 aria-label="Sair do modo imersivo"
                 className="absolute top-6 right-6 p-3 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-white transition-all z-50"
             >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             {/* Central Neural Audio Visualizer */}
             <div className="flex-1 w-full h-full flex items-center justify-center relative">
                 <canvas ref={immersiveCanvasRef} className="w-full h-full absolute inset-0" />
             </div>

             {/* Minimalist Bottom Controls */}
             <div className="absolute bottom-8 flex items-center gap-6 p-4 rounded-full bg-[var(--bg-secondary)]/50 backdrop-blur-md border border-[var(--border-color)]/30">
                 <button onClick={handleToggleTextToSpeech} aria-label={isTextToSpeechEnabled ? "Desativar Voz" : "Ativar Voz"} aria-pressed={isTextToSpeechEnabled} className={`p-3 rounded-full transition-colors ${isTextToSpeechEnabled ? 'text-green-400' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                 </button>
                 
                 <div className="w-px h-6 bg-[var(--border-color)]/50"></div>

                 <button onClick={() => { setIsImmersiveMode(false); setTimeout(() => textareaRef.current?.focus(), 100); }} aria-label="Voltar para o modo de texto" className="p-3 rounded-full text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                 </button>

                 <button
                    onClick={() => handleToggleMicrophone()}
                    aria-label={isMicActive ? "Desligar microfone" : "Ligar microfone"}
                    aria-pressed={isMicActive}
                    className={`p-4 rounded-full transition-all duration-300 shadow-lg ${isMicActive ? 'bg-green-500 text-white animate-pulse' : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'}`}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                 </button>

                 <button onClick={isCameraActive ? stopCamera : startCamera} aria-label={isCameraActive ? "Desligar câmera" : "Ligar câmera"} aria-pressed={isCameraActive} className={`p-3 rounded-full transition-colors ${isCameraActive ? 'text-white bg-green-500 animate-pulse shadow-lg' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>

                 <button onClick={isScreenSharing ? stopScreenSharing : startScreenSharing} aria-label={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"} aria-pressed={isScreenSharing} className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'text-white bg-green-500 animate-pulse shadow-lg' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                 </button>
             </div>
         </div>
      )}

      {/* Main Chat Area - Hidden in Immersive Mode */}
      <main className={`flex-1 flex flex-col relative h-full transition-opacity duration-500 overflow-hidden ${isImmersiveMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
         
         {/* Top Bar (Mobile menu toggle + Agent Selector + Full Screen Toggle) */}
         <div className="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-4 bg-[var(--bg-primary)] z-10 flex-shrink-0">
             
             {/* Left Section: Logo and Navigation */}
             <div className="flex items-center z-10 space-x-2">
                 <ChicoLogo className="text-xl" />
                 
                 <div className="w-px h-6 bg-[var(--border-color)] mx-2 hidden sm:block"></div>

                 {/* New Chat Button */}
                 <button 
                    onClick={handleNewChat}
                    className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1"
                    title="Novo Chat"
                    aria-label="Novo Chat"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                     <span className="text-xs font-bold hidden md:inline">Novo Chat</span>
                  </button>

                  {/* Botão Agente Autônomo */}
          <button
            onClick={() => setShowAgentPanel(true)}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-all flex items-center gap-2"
            title="Abrir Agente Autônomo"
            aria-label="Abrir Agente Autônomo"
          >
            <span className="text-xl">🤖</span>
            <span className="text-xs font-bold hidden md:inline">Agente</span>
          </button>


                 {/* Browser Toggle Button (Vision AI / RPA / Headless) */}
                 <button 
                    onClick={() => setIsBrowserOpen(!isBrowserOpen)}
                    className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isBrowserOpen ? 'bg-[var(--accent-primary)] text-white shadow-lg' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]'}`}
                    title={isBrowserOpen ? "Fechar Navegador" : "Abrir Navegador RPA (Vision AI)"}
                    aria-label={isBrowserOpen ? "Fechar Navegador" : "Abrir Navegador RPA (Vision AI)"}
                    aria-pressed={isBrowserOpen}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-xs font-bold hidden sm:inline">Vision AI / RPA</span>
                 </button>

                 {/* FocoFlow Dashboard Toggle (Computational) */}
                 <button 
                    onClick={() => setIsFocoFlowDashboardOpen(!isFocoFlowDashboardOpen)}
                    className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isFocoFlowDashboardOpen ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-blue-500'}`}
                    title="Painel FocoFlow (Computacional)"
                    aria-label="Painel FocoFlow (Computacional)"
                    aria-pressed={isFocoFlowDashboardOpen}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-xs font-bold hidden sm:inline">FocoFlow</span>
                 </button>
             </div>

             {/* Right Section: Agent Selector + Settings + Notifications */}
             <div className="flex items-center space-x-2">
                 {/* Agent Selector */}
                 <button 
                     onClick={() => setIsAgentsModalOpen(true)}
                     className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-all group"
                 >
                     <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-[var(--accent-primary-text)] text-[10px] font-bold">
                         {SYSTEM_AGENTS.find(a => a.id === activeAgent)?.name.charAt(0) || 'A'}
                     </div>
                     <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                         {SYSTEM_AGENTS.find(a => a.id === activeAgent)?.name || 'Agente'}
                     </span>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                 </button>

                 <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>

                 {/* Notifications */}
                 <button 
                     onClick={() => setIsNotificationsModalOpen(true)}
                     className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors relative"
                     title="Notificações"
                     aria-label="Notificações"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                     {unreadNotifications && (
                         <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border border-[var(--bg-primary)]"></span>
                     )}
                 </button>

                 {/* Settings */}
                 <button 
                    onClick={() => setIsSettingsModalOpen(true)} 
                    className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                    title="Configurações"
                    aria-label="Configurações"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>

                 {/* Logout */}
                 <button 
                    onClick={handleLogout} 
                    className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                    title="Sair"
                    aria-label="Sair"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 </button>
             </div>
         </div>

        {/* Live Camera/Screen Video - FIXED AT TOP */}
        <div className={`w-full flex justify-center bg-[var(--bg-primary)]/50 backdrop-blur-sm border-b border-[var(--border-color)] transition-all duration-300 overflow-hidden flex-shrink-0 ${isCameraActive || isScreenSharing ? 'py-4 max-h-[50vh] opacity-100' : 'max-h-0 opacity-0 border-none'}`}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-black max-w-2xl w-full min-h-[200px]">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-auto max-h-[40vh] object-contain"
                />
                {/* Live Indicator */}
                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full z-10">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-white text-xs font-bold tracking-wider">AO VIVO</span>
                </div>
            </div>
        </div>

         {/* Messages */}
         <div 
             className="flex-1 overflow-y-auto p-4 space-y-6 relative min-h-0" 
             id="chat-container"
             ref={chatContainerRef}
             onScroll={handleChatScroll}
         >
            {isMessagesLoading ? (
                 <LoadingSpinner message="Carregando mensagens..." />
             ) : (!activeMessages || activeMessages.length === 0) ? (
                 <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
                     <ChicoLogo className="mb-6 opacity-80 scale-125" />
                     <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Chico</h2>
                     <p className="mb-6 opacity-70">Siga pelas redes sociais:</p>
                     <div className="flex gap-4 mb-8">
                         {socialLinks?.instagram && (
                             <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-3 bg-[var(--bg-secondary)] rounded-full hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-lg border border-[var(--border-color)]" title="Instagram">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 2a5 5 0 00-5 5v10a5 5 0 005 5h10a5 5 0 005-5V7a5 5 0 00-5-5H7zm0 2h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.5 6.5a1 1 0 110 2 1 1 0 010-2z" /></svg>
                             </a>
                         )}
                         {socialLinks?.site && (
                             <a href={socialLinks.site} target="_blank" rel="noopener noreferrer" className="p-3 bg-[var(--bg-secondary)] rounded-full hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-lg border border-[var(--border-color)]" title="Site">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                             </a>
                         )}
                         {socialLinks?.facebook && (
                             <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="p-3 bg-[var(--bg-secondary)] rounded-full hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-lg border border-[var(--border-color)]" title="Facebook">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>
                             </a>
                         )}
                     </div>
                     <p className="text-sm opacity-50">Inicie uma conversa por voz ou texto.</p>
                 </div>
             ) : (
                 (activeMessages || []).map((msg) => (
                     <MessageItem key={msg.id} msg={msg} />
                 ))
             )}
             
             {/* Live Transcription Overlay */}
             {(currentInputTranscription || currentOutputTranscription) && (
                 <div className="flex w-full justify-center my-4">
                     <div className="bg-[var(--bg-tertiary)]/90 backdrop-blur-sm border border-[var(--accent-primary)] rounded-lg p-4 max-w-xl text-center shadow-lg animate-pulse">
                         <p className="text-sm font-medium text-[var(--accent-primary)] mb-1">
                             {currentInputTranscription ? 'Ouvindo...' : 'Chico está falando...'}
                         </p>
                         <p className="text-lg text-[var(--text-primary)]">
                             {currentInputTranscription || currentOutputTranscription}
                         </p>
                     </div>
                 </div>
             )}
             
             {silencePromptVisible && isMicActive && !isSpeaking && (
                 <div className="flex w-full justify-center my-2">
                     <div className="bg-yellow-500/20 text-yellow-200 text-xs px-3 py-1 rounded-full border border-yellow-500/30">
                         Chico está ouvindo... (Fale "Pare de ouvir" para encerrar)
                     </div>
                 </div>
             )}
          </div>

               <div className="p-3 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex-shrink-0">
             <div className="max-w-5xl mx-auto flex items-center space-x-2">
                 {/* Text-to-Speech Toggle */}
                 <button
                    onClick={handleToggleTextToSpeech}
                    className={`p-2 rounded-lg transition-all ${isTextToSpeechEnabled ? 'text-green-500 bg-green-500/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                    title={isTextToSpeechEnabled ? "Desativar Voz" : "Ativar Voz"}
                    aria-label={isTextToSpeechEnabled ? "Desativar Voz" : "Ativar Voz"}
                    aria-pressed={isTextToSpeechEnabled}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                 </button>

                 <div className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl flex items-center px-3 py-1.5 focus-within:ring-1 focus-within:ring-[var(--accent-primary)] transition-all">
                        <button onClick={() => attachmentFileInputRef.current?.click()} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] p-1.5" title="Anexar" aria-label="Anexar arquivo">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <textarea 
                            ref={textareaRef}
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Mensagem..."
                            className="flex-1 bg-transparent border-none focus:outline-none resize-none max-h-32 py-1 text-sm"
                            rows={1}
                        />
                        {/* Mic Toggle Integrated */}
                        <button 
                            onClick={() => handleToggleMicrophone()}
                            className={`p-2 rounded-full transition-all ${isMicActive ? 'text-green-500 animate-pulse' : 'text-[var(--text-secondary)] hover:text-[var(--accent-primary)]'}`}
                        >
                            {isMicLoading ? (
                                <div className="animate-spin h-5 w-5 border-2 border-current rounded-full border-t-transparent"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            )}
                        </button>
                 </div>
                 
                 <button 
                    onClick={handleSend}
                    disabled={!textInput.trim() && !isMicActive} 
                    className={`p-2.5 rounded-xl transition-all ${textInput.trim() ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-text)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                 </button>

                 <div className="flex items-center space-x-1">
                     <button
                        onClick={isCameraActive ? stopCamera : startCamera}
                        className={`p-2 rounded-lg transition-all ${isCameraActive ? 'text-green-500 bg-green-500/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     </button>

                     <button 
                        onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
                        className={`p-2 rounded-lg transition-all ${isScreenSharing ? 'text-green-500 bg-green-500/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                     </button>
                 </div>
             </div>
             <p className="text-center text-[10px] text-[var(--text-secondary)] mt-2 opacity-50">Pressione <strong>Ctrl</strong> para falar (Push-to-Talk não implementado no navegador, use o botão)</p>
         </div>

         {/* Error Toast */}
         {errorMessage && (
             <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center animate-bounce">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                 {errorMessage}
                 <button onClick={() => setErrorMessage(null)} className="ml-4 font-bold hover:text-red-200">&times;</button>
             </div>
         )}
      </main>

      {/* Modals */}
      <VisualHelpModal data={visualHelp} onClose={() => setVisualHelp(null)} />
      
      <ConfirmationModal 
          isOpen={!!chatToDelete} 
          onClose={() => setChatToDelete(null)}
          onConfirm={handleDeleteConversation}
          title="Excluir Conversa"
          message="Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita."
      />
      
      <NotificationsModal
          isOpen={isNotificationsModalOpen}
          onClose={() => setIsNotificationsModalOpen(false)}
          notifications={notifications}
      />
      
      <FocoFlowDashboard 
         isOpen={isFocoFlowDashboardOpen}
         onClose={() => setIsFocoFlowDashboardOpen(false)}
         userId={user?.uid || ''}
      />

      <AgentsModal 
        isOpen={isAgentsModalOpen}
        onClose={() => setIsAgentsModalOpen(false)}
        onActivate={handleActivateAgent}
        onDeactivate={handleDeactivateAgent}
        activeAgent={activeAgent}
        customAgents={customAgents}
        onCreateAgent={handleCreateCustomAgent}
        onUpdateAgent={handleUpdateCustomAgent}
        onDeleteAgent={handleDeleteCustomAgent}
      />

      <ArchivedConversationsModal
          isOpen={isArchivedModalOpen}
          onClose={() => setIsArchivedModalOpen(false)}
          archivedConversations={archivedConversations}
          onRestoreConversation={handleRestoreConversation}
      />

      <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          user={user}
          chicoCustomName={chicoCustomName}
          setChicoCustomName={setChicoCustomName}
          userPreferredName={userPreferredName}
          setUserPreferredName={setUserPreferredName}
          theme={theme}
          setTheme={setTheme}
          tempColor={tempColor}
          setTempColor={setTempColor}
          setCustomThemeColor={setCustomThemeColor}
          onApplyTheme={onApplyTheme}
          voiceName={voiceName}
          setVoiceName={setVoiceName}
          integrations={integrations}
          setIntegrations={setIntegrations}
          socialLinks={socialLinks}
          setSocialLinks={setSocialLinks}
          userApiKey={userApiKey || ''}
          onSaveApiKey={saveUserApiKey}
          validateApiKey={validateApiKey}
          userFirecrawlKey={userFirecrawlKey}
          userSkyvernKey={userSkyvernKey}
          onSaveFirecrawlKey={(k: string) => saveServiceKey('userFirecrawlKey', k)}
          onSaveSkyvernKey={(k: string) => saveServiceKey('userSkyvernKey', k)}
          userOpenRouterKey={userOpenRouterKey}
          userOpenRouterModel={userOpenRouterModel}
          onSaveOpenRouter={saveOpenRouter}
          onOpenArchived={() => { setIsSettingsModalOpen(false); setIsArchivedModalOpen(true); }}
          onOpenFocoFlow={() => { setIsSettingsModalOpen(false); setIsFocoFlowModalOpen(true); }}
      />

       {/* FocoFlow Integration Modal */}
       <FocoFlowIntegration
           isOpen={isFocoFlowModalOpen}
           onClose={() => setIsFocoFlowModalOpen(false)}
       />

       <InternalBrowser 
          isOpen={isBrowserOpen} 
          onClose={() => setIsBrowserOpen(false)}
          onMicClick={() => handleToggleMicrophone()}
          isMicActive={isMicActive}
          messages={activeMessages}
          onSendMessage={(text) => handleSend(text)}
          isVisionActive={isScreenSharing}
          onToggleVision={() => setIsScreenSharing(!isScreenSharing)}
          isAiInspecting={isAiInspecting}
       />

    </div>
  );
};

export default App;