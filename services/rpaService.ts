import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { RpaWorkflow, RpaStep, RpaLogEntry, RpaStepType, RpaStepStatus, RpaWorkflowStatus } from '../types';

const RPA_COLLECTION = 'rpa_workflows';
const RPA_LOGS_COLLECTION = 'rpa_logs';

// === Workflow CRUD ===

export const createWorkflow = async (uid: string, name: string, description: string): Promise<string> => {
  const workflow: Omit<RpaWorkflow, 'id'> = {
    uid,
    name,
    description,
    steps: [],
    status: 'idle',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
  };
  try {
    const docRef = await addDoc(collection(db, RPA_COLLECTION), workflow);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, RPA_COLLECTION);
    throw error;
  }
};

export const getWorkflows = async (uid: string): Promise<RpaWorkflow[]> => {
  const q = query(collection(db, RPA_COLLECTION), where('uid', '==', uid), orderBy('updatedAt', 'desc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RpaWorkflow));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, RPA_COLLECTION);
    return [];
  }
};

export const updateWorkflow = async (id: string, data: Partial<RpaWorkflow>): Promise<void> => {
  const path = `${RPA_COLLECTION}/${id}`;
  try {
    await updateDoc(doc(db, RPA_COLLECTION, id), { ...data, updatedAt: new Date() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

export const deleteWorkflow = async (id: string): Promise<void> => {
  const path = `${RPA_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, RPA_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};

// === Step Helpers ===

export const createStep = (type: RpaStepType, label: string, config: any = {}): RpaStep => ({
  id: crypto.randomUUID(),
  type,
  label,
  config,
  status: 'pending',
});

// === RPA Execution Engine ===

let rpaWindow: Window | null = null;
let rpaIframe: HTMLIFrameElement | null = null;
let logCallbacks: ((entry: RpaLogEntry) => void)[] = [];

export const registerRpaIframe = (iframe: HTMLIFrameElement) => {
  rpaIframe = iframe;
};

export const onRpaLog = (cb: (entry: RpaLogEntry) => void) => {
  logCallbacks.push(cb);
  return () => { logCallbacks = logCallbacks.filter(c => c !== cb); };
};

const emitLog = (workflowId: string, stepId: string, level: RpaLogEntry['level'], message: string, data?: any) => {
  const entry: RpaLogEntry = {
    id: crypto.randomUUID(),
    workflowId,
    stepId,
    timestamp: new Date(),
    level,
    message,
    data,
  };
  logCallbacks.forEach(cb => cb(entry));
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const executeStepInWindow = async (step: RpaStep, targetWindow: Window): Promise<string> => {
  try {
    // Check if we can access the document (CORS check)
    const doc = targetWindow.document;
    console.log("Accessing target window document:", doc.title);
  } catch (e) {
    throw new Error("Cannot access target window due to security restrictions (CORS). Please use same-origin URLs or a browser extension.");
  }

  switch (step.type) {
    case 'navigate': {
      const targetUrl = step.config.url || '';
      const proxyBase = '__PORT_8000__'.startsWith('__') ? '' : '__PORT_8000__';
      const proxyUrl = `${proxyBase}/proxy?url=${encodeURIComponent(targetUrl)}`;
      targetWindow.location.href = proxyUrl;
      await delay(step.config.timeout || 3000);
      return `Navigated to ${targetUrl} (via proxy)`;
    }

    case 'click': {
      const el = targetWindow.document.querySelector(step.config.selector || '');
      if (!el) throw new Error(`Element not found: ${step.config.selector}`);
      (el as HTMLElement).click();
      return `Clicked: ${step.config.selector}`;
    }

    case 'type': {
      const input = targetWindow.document.querySelector(step.config.selector || '') as HTMLInputElement;
      if (!input) throw new Error(`Input not found: ${step.config.selector}`);
      input.focus();
      input.value = step.config.text || '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return `Typed text in: ${step.config.selector}`;
    }

    case 'extract': {
      const target = targetWindow.document.querySelector(step.config.selector || '');
      if (!target) throw new Error(`Element not found: ${step.config.selector}`);
      const attr = step.config.attribute;
      const value = attr ? target.getAttribute(attr) : target.textContent;
      return value || '';
    }

    case 'wait':
      await delay(step.config.timeout || 2000);
      return `Waited ${step.config.timeout || 2000}ms`;

    case 'screenshot':
      return 'Screenshot captured (canvas-based capture not available in cross-origin)';

    case 'script': {
      const result = (targetWindow as any).eval(step.config.script || '');
      return String(result);
    }

    case 'getPageMap': {
      const elements = targetWindow.document.querySelectorAll('button, input, a, select, textarea, [role="button"], [onclick]');
      const map = Array.from(elements).map((el: any, index) => {
        const rect = el.getBoundingClientRect();
        const style = targetWindow.getComputedStyle(el);
        const label = targetWindow.document.querySelector(`label[for="${el.id}"]`)?.textContent || el.getAttribute('aria-label') || el.placeholder || undefined;
        
        return {
          index,
          tagName: el.tagName,
          type: el.type || undefined,
          placeholder: el.placeholder || undefined,
          text: (el.innerText || el.value || '').substring(0, 50).trim(),
          ariaLabel: el.getAttribute('aria-label') || undefined,
          label: label,
          id: el.id || undefined,
          className: el.className || undefined,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        };
      }).filter(el => el.isVisible);
      
      const selects = Array.from(targetWindow.document.querySelectorAll('select')).map((sel: any) => ({
        tagName: 'SELECT',
        id: sel.id,
        options: Array.from(sel.options).map((opt: any) => opt.text),
        value: sel.value
      }));

      return JSON.stringify({
        url: targetWindow.location.href,
        elements: map,
        selects: selects
      });
    }

    case 'scroll': {
      const { selector, text } = step.config; // text can be 'up', 'down' or 'top', 'bottom'
      if (selector) {
        const el = targetWindow.document.querySelector(selector);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        const direction = text?.toLowerCase();
        if (direction === 'up') targetWindow.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
        else if (direction === 'down') targetWindow.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
        else if (direction === 'top') targetWindow.scrollTo({ top: 0, behavior: 'smooth' });
        else if (direction === 'bottom') targetWindow.scrollTo({ top: targetWindow.document.body.scrollHeight, behavior: 'smooth' });
      }
      return `Scrolled ${selector || text}`;
    }

    case 'hover': {
      const el = targetWindow.document.querySelector(step.config.selector || '');
      if (!el) throw new Error(`Element not found: ${step.config.selector}`);
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      return `Hovered: ${step.config.selector}`;
    }

    case 'wait_for_element': {
      const selector = step.config.selector || '';
      const timeout = step.config.timeout || 10000;
      
      return new Promise((resolve, reject) => {
        const el = targetWindow.document.querySelector(selector);
        if (el) return resolve(`Element already exists: ${selector}`);

        const observer = new MutationObserver((mutations, obs) => {
          const el = targetWindow.document.querySelector(selector);
          if (el) {
            obs.disconnect();
            resolve(`Element appeared: ${selector}`);
          }
        });

        observer.observe(targetWindow.document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
      }) as unknown as string;
    }

    default:
      return 'Step type not implemented';
  }
};

export const executeWorkflow = async (
  workflow: RpaWorkflow,
  onStepUpdate: (stepId: string, status: RpaStepStatus, result?: string, error?: string) => void,
  useIframe: boolean = false
): Promise<void> => {
  emitLog(workflow.id, '', 'info', `Starting workflow: ${workflow.name}`);

  let target: Window | null = null;

  if (useIframe && rpaIframe) {
    target = rpaIframe.contentWindow;
  } else {
    // Open target window
    const firstNavStep = workflow.steps.find(s => s.type === 'navigate');
    const startUrl = firstNavStep?.config.url || 'about:blank';
    rpaWindow = window.open(startUrl, 'rpa_target', 'width=1200,height=800,scrollbars=yes');
    target = rpaWindow;
  }

  if (!target) {
    emitLog(workflow.id, '', 'error', 'Failed to acquire target window/iframe.');
    return;
  }

  await delay(3000); // Wait for initial page load

  for (const step of workflow.steps) {
    if (step.type === 'navigate' && step === workflow.steps.find(s => s.type === 'navigate')) {
      // Skip navigation if it was already handled by opening the window/iframe
      // But only if it's the first navigation step
      if (!useIframe) {
        onStepUpdate(step.id, 'success', `Navigated to ${step.config.url}`);
        emitLog(workflow.id, step.id, 'success', `Navigated to ${step.config.url}`);
        continue;
      }
    }

    onStepUpdate(step.id, 'running');
    emitLog(workflow.id, step.id, 'info', `Executing: ${step.label}`);

    try {
      const result = await executeStepInWindow(step, target);
      onStepUpdate(step.id, 'success', result);
      emitLog(workflow.id, step.id, 'success', result);
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      onStepUpdate(step.id, 'error', undefined, errorMsg);
      emitLog(workflow.id, step.id, 'error', errorMsg);
      break;
    }

    await delay(500); // Small delay between steps
  }

  emitLog(workflow.id, '', 'info', 'Workflow completed');
};

export const stopWorkflow = () => {
  if (rpaWindow && !rpaWindow.closed) {
    rpaWindow.close();
  }
  rpaWindow = null;
};

// === AI Workflow Generator ===

export const generateWorkflowFromPrompt = (prompt: string): RpaStep[] => {
  // Basic parser - extracts steps from natural language
  const steps: RpaStep[] = [];
  const lines = prompt.split(/[.,;\n]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('acesse') || lower.includes('navegue') || lower.includes('abra') || lower.includes('entre no site') || lower.includes('go to')) {
      const urlMatch = line.match(/https?:\/\/[^\s]+/) || line.match(/www\.[^\s]+/);
      steps.push(createStep('navigate', `Navegar: ${urlMatch?.[0] || line}`, { url: urlMatch?.[0] || '', timeout: 3000 }));
    } else if (lower.includes('clique') || lower.includes('click') || lower.includes('pressione')) {
      const selectorMatch = line.match(/["']([^"']+)["']/) || line.match(/#[\w-]+/) || line.match(/\.[\w-]+/);
      steps.push(createStep('click', `Clicar: ${selectorMatch?.[1] || selectorMatch?.[0] || line}`, { selector: selectorMatch?.[1] || selectorMatch?.[0] || '' }));
    } else if (lower.includes('digit') || lower.includes('escrev') || lower.includes('type') || lower.includes('preencha')) {
      const textMatch = line.match(/["']([^"']+)["']/);
      steps.push(createStep('type', `Digitar: ${textMatch?.[1] || ''}`, { selector: '', text: textMatch?.[1] || '' }));
    } else if (lower.includes('extraia') || lower.includes('copie') || lower.includes('pegue') || lower.includes('extract')) {
      steps.push(createStep('extract', `Extrair: ${line}`, { selector: '', attribute: '' }));
    } else if (lower.includes('espere') || lower.includes('aguarde') || lower.includes('wait')) {
      const timeMatch = line.match(/(\d+)/);
      steps.push(createStep('wait', `Esperar ${timeMatch?.[1] || '2'}s`, { timeout: (parseInt(timeMatch?.[1] || '2')) * 1000 }));
    }
  }

  return steps;
};

// === RPA Helpers for Agent ===

export const fillForm = async (fields: Record<string, string>): Promise<void> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');

  for (const [selector, text] of Object.entries(fields)) {
    await executeStepInWindow(createStep('type', `Fill ${selector}`, { selector, text }), target);
  }
};

export const extractData = async (selector: string): Promise<string> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');

  return await executeStepInWindow(createStep('extract', `Extract ${selector}`, { selector }), target);
};

export const scrollPage = async (direction: 'up' | 'down' | 'top' | 'bottom', selector?: string): Promise<void> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');
  await executeStepInWindow(createStep('scroll', `Scroll ${direction}`, { text: direction, selector }), target);
};

export const hoverElement = async (selector: string): Promise<void> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');
  await executeStepInWindow(createStep('hover', `Hover ${selector}`, { selector }), target);
};

export const waitForElement = async (selector: string, timeout: number = 10000): Promise<string> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');
  return await executeStepInWindow(createStep('wait_for_element', `Wait for ${selector}`, { selector, timeout }), target);
};

export const getPageMap = async (): Promise<any> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');

  const result = await executeStepInWindow(createStep('getPageMap' as any, 'Get Page Map'), target);
  return JSON.parse(result);
};

export const captureSnapshot = async (): Promise<string> => {
  if (!rpaIframe && !rpaWindow) throw new Error('No target window/iframe for RPA');
  const target = rpaIframe?.contentWindow || rpaWindow;
  if (!target) throw new Error('Target window not available');

  // Since we are using a proxy, we might be able to use html2canvas if it's installed
  // or a simpler approach if we just want the DOM structure.
  // For a real snapshot, we'd ideally use a backend service or a browser extension.
  // Here we will simulate it by returning the page title and a summary for now,
  // or try to use a canvas-based approach if possible.
  
  // For now, let's return a "Visual Summary" as text which is very cost-effective.
  const map = await getPageMap();
  return `Snapshot of ${target.document.title}: Found ${map.length} interactive elements. URL: ${target.location.href}`;
};

export const rpaService = {
  createWorkflow,
  getWorkflows,
  updateWorkflow,
  deleteWorkflow,
  createStep,
  registerRpaIframe,
  onRpaLog,
  executeWorkflow,
  stopWorkflow,
  generateWorkflowFromPrompt,
  fillForm,
  extractData,
  scrollPage,
  hoverElement,
  waitForElement,
  getPageMap,
  captureSnapshot
};
