// ============================================================
// AGENT SERVICE - Loop Autônomo Plan→Act→Observe→Reflect
// ============================================================

export type AgentStatus = 'idle' | 'planning' | 'executing' | 'completed' | 'error';

export interface AgentStep {
  id: string;
  description: string;
  tool: string;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  timestamp: Date;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: AgentStatus;
  steps: AgentStep[];
  result?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type ToolName = 'calculate' | 'searchKnowledge' | 'navigateBrowser' | 'readScreen' | 'executeShell' | 'fillForm' | 'extractData' | 'clickByText' | 'scrollPage' | 'hoverElement' | 'waitForElement' | 'readPage' | 'searchWeb' | 'extractPage';

export interface Tool {
  name: ToolName;
  description: string;
  execute: (input: string, context?: any) => Promise<string>;
}

class AgentService {
  private tasks: AgentTask[] = [];
  private memory: string[] = []; // Short-term memory (observations)
  private tools: Map<ToolName, Tool> = new Map();
  private iframeRef: HTMLIFrameElement | null = null;
  private onUpdateCallback?: (task: AgentTask) => void;

  constructor() {
    this.registerDefaultTools();
    this.loadTasksFromStorage();
  }

  // Register iframe reference for browser automation
  setIframeRef(iframe: HTMLIFrameElement | null) {
    this.iframeRef = iframe;
  }

  // Subscribe to task updates
  onUpdate(cb: (task: AgentTask) => void) {
    this.onUpdateCallback = cb;
  }

  private notify(task: AgentTask) {
    this.onUpdateCallback?.(task);
    this.saveTasksToStorage();
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ---- TOOLS REGISTRATION ----
  private registerDefaultTools() {
    this.registerTool({
      name: 'calculate',
      description: 'Realiza cálculos matemáticos e lógicos',
      execute: async (input: string) => {
        try {
          // Safe math evaluation
          const sanitized = input.replace(/[^0-9+\-*/().\s]/g, '');
          const result = Function(`"use strict"; return (${sanitized})`)();
          return `Resultado: ${result}`;
        } catch (e) {
          return `Erro no cálculo: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'searchKnowledge',
      description: 'Busca conhecimento na base RAG local',
      execute: async (input: string) => {
        try {
          const { ragService } = await import('./ragService');
          return ragService.buildContext(input);
        } catch {
          return 'Base de conhecimento não disponível ainda.';
        }
      }
    });

    this.registerTool({
      name: 'navigateBrowser',
      description: 'Navega para uma URL no browser interno',
      execute: async (input: string) => {
        try {
          const url = input.startsWith('http') ? input : `https://${input}`;
          const { isServerSideMode } = await import('./rpaService');
          if (isServerSideMode()) {
            const { rpaClient } = await import('./rpaClient');
            const res = await rpaClient.navigate(url);
            return res.ok ? `Navegando para: ${url}` : `Erro ao navegar: ${res.error || res.message}`;
          }
          if (!this.iframeRef) return 'Browser interno não disponível.';
          this.iframeRef.src = url;
          await new Promise(r => setTimeout(r, 2000));
          return `Navegando para: ${url}`;
        } catch (e) {
          return `Erro ao navegar: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'readScreen',
      description: 'Lê o conteúdo textual e visual da tela/browser',
      execute: async (_input: string) => {
        try {
          let text = '';
          let domSummary = '';
          const { isServerSideMode } = await import('./rpaService');
          if (isServerSideMode()) {
            const { rpaClient } = await import('./rpaClient');
            const dom = await rpaClient.dom();
            if (dom.ok) {
              const labels = (dom.elements || [])
                .map(e => e.text || e.label || e.placeholder)
                .filter(Boolean)
                .slice(0, 30);
              return `Página (server-side): ${dom.title || ''} — URL: ${dom.url}\nElementos interativos: ${labels.join(', ')}`;
            }
          }
          if (this.iframeRef) {
            try {
              const doc = this.iframeRef.contentDocument || this.iframeRef.contentWindow?.document;
              if (doc) {
                text = doc.body?.innerText?.slice(0, 3000) || 'Página vazia';
                // Extract interactive elements for better reasoning
                const buttons = Array.from(doc.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
                  .map(el => (el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute('aria-label'))
                  .filter(Boolean)
                  .slice(0, 20);
                domSummary = `Botões/Links encontrados: ${buttons.join(', ')}`;
              }
            } catch (e) {
              text = 'Erro ao acessar DOM. Use Vision AI.';
            }
          }

          const { visionService } = await import('./visionService');
          const frame = visionService.getCurrentFrame();
          
          let analysis = '';
          if (frame) {
            analysis = await visionService.analyzeFrame(frame);
          }

          return `Conteúdo textual: ${text}\n\n${domSummary}\n\nAnálise Visual: ${analysis}`;
        } catch (e) {
          return `Erro ao ler tela: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'clickByText',
      description: 'Clica em um elemento que contém o texto especificado',
      execute: async (input: string) => {
        try {
          const { isServerSideMode } = await import('./rpaService');
          if (isServerSideMode()) {
            const { rpaClient } = await import('./rpaClient');
            const dom = await rpaClient.dom();
            if (!dom.ok) return `Erro ao ler página: ${dom.error}`;
            const target = (dom.elements || []).find(e =>
              (e.text || '').toLowerCase().includes(input.toLowerCase()) ||
              (e.label || '').toLowerCase().includes(input.toLowerCase())
            );
            if (!target) return `Elemento com texto "${input}" não encontrado.`;
            const cx = target.rect.x + target.rect.width / 2;
            const cy = target.rect.y + target.rect.height / 2;
            const res = await rpaClient.clickAt(Math.round(cx), Math.round(cy));
            return res.ok ? `Clicado em: "${input}"` : `Erro ao clicar: ${res.error}`;
          }
          if (!this.iframeRef) return 'Browser não disponível.';
          const doc = this.iframeRef.contentDocument || this.iframeRef.contentWindow?.document;
          if (!doc) return 'Documento não acessível.';

          const elements = Array.from(doc.querySelectorAll('button, a, span, div, p, label, input'));
          const target = elements.find(el => 
            el.textContent?.toLowerCase().includes(input.toLowerCase()) || 
            el.getAttribute('aria-label')?.toLowerCase().includes(input.toLowerCase())
          );

          if (!target) return `Elemento com texto "${input}" não encontrado.`;

          const rect = (target as HTMLElement).getBoundingClientRect();
          
          // Trigger visual feedback on parent canvas
          window.dispatchEvent(new CustomEvent('agent-draw', {
            detail: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
              label: `Clicando: ${input}`
            }
          }));

          // Visual feedback in iframe
          const indicator = doc.createElement('div');
          Object.assign(indicator.style, {
            position: 'absolute',
            top: `${rect.top + doc.defaultView!.scrollY}px`,
            left: `${rect.left + doc.defaultView!.scrollX}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            border: '3px solid #00B7FF',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: '999999',
            boxShadow: '0 0 15px #00B7FF',
            transition: 'all 0.5s ease-out'
          });
          doc.body.appendChild(indicator);
          setTimeout(() => {
            indicator.style.opacity = '0';
            indicator.style.transform = 'scale(1.2)';
            setTimeout(() => indicator.remove(), 500);
          }, 1000);

          (target as HTMLElement).click();
          return `Clicado em: "${input}"`;
        } catch (e) {
          return `Erro ao clicar por texto: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'executeShell',
      description: 'Executa comando PowerShell seguro',
      execute: async (input: string) => {
        try {
          const { shellService } = await import('./shellService');
          const result = await shellService.executeCommand(input);
          return result.stdout || result.stderr || 'Comando executado.';
        } catch (e) {
          return `Erro shell: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'fillForm',
      description: 'Preenche formulário no browser com dados',
      execute: async (input: string) => {
        try {
          const fields = JSON.parse(input) as Record<string, string>;
          const { rpaService } = await import('./rpaService');
          await rpaService.fillForm(fields);
          return `Formulário preenchido com ${Object.keys(fields).length} campos.`;
        } catch (e) {
          return `Erro ao preencher formulário: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'extractData',
      description: 'Extrai dados específicos da página (OCR ou Seletores)',
      execute: async (input: string) => {
        try {
          const { rpaService } = await import('./rpaService');
          const { visionService } = await import('./visionService');
          
          let result = '';
          try {
            result = await rpaService.extractData(input);
          } catch (e) {
            // Fallback to OCR if selector fails or CORS
            const frame = visionService.getCurrentFrame();
            if (frame) {
              result = await visionService.extractText(frame);
            } else {
              result = 'Seletor falhou e Vision não está ativo.';
            }
          }
          return `Dados extraídos: ${result}`;
        } catch (e) {
          return `Erro ao extrair dados: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'scrollPage',
      description: 'Realiza scroll na página (up, down, top, bottom)',
      execute: async (input: string) => {
        try {
          const { scrollPage } = await import('./rpaService');
          await scrollPage(input as any);
          return `Scroll executado: ${input}`;
        } catch (e) {
          return `Erro ao scroll: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'hoverElement',
      description: 'Simula hover em um seletor CSS',
      execute: async (input: string) => {
        try {
          const { hoverElement } = await import('./rpaService');
          await hoverElement(input);
          return `Hover executado em: ${input}`;
        } catch (e) {
          return `Erro ao hover: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'waitForElement',
      description: 'Aguarda um elemento aparecer na página',
      execute: async (input: string) => {
        try {
          const { waitForElement } = await import('./rpaService');
          await waitForElement(input);
          return `Elemento encontrado: ${input}`;
        } catch (e) {
          return `Erro ao aguardar elemento: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'readPage',
      description: 'LÊ/resume o conteúdo de uma URL (markdown/texto). Firecrawl com fallback para navegador. Use para "ler/resumir" sites, sem interagir.',
      execute: async (input: string) => {
        try {
          const { webClient } = await import('./webClient');
          const url = input.startsWith('http') ? input : `https://${input}`;
          const res = await webClient.read(url);
          if (!res.ok) return `Erro ao ler página: ${res.message || res.error}`;
          const content = res.markdown || res.text || '';
          return `[fonte: ${res.source}] ${res.title || res.url}\n\n${content.slice(0, 4000)}`;
        } catch (e) {
          return `Erro ao ler página: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'searchWeb',
      description: 'Pesquisa na web (Firecrawl) e retorna lista de resultados {título, url, trecho}.',
      execute: async (input: string) => {
        try {
          const { webClient } = await import('./webClient');
          const res = await webClient.search(input);
          if (!res.ok) return `Erro na pesquisa: ${res.message || res.error}`;
          return (res.results || []).map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n${r.snippet}`).join('\n\n') || 'Sem resultados.';
        } catch (e) {
          return `Erro na pesquisa: ${e}`;
        }
      }
    });

    this.registerTool({
      name: 'extractPage',
      description: 'Extrai dados estruturados de uma URL via Firecrawl. Input: a URL (opcionalmente descreva os campos).',
      execute: async (input: string) => {
        try {
          const { webClient } = await import('./webClient');
          const url = input.startsWith('http') ? input : `https://${input}`;
          const res = await webClient.extract(url);
          if (!res.ok) return `Erro ao extrair: ${res.message || res.error}`;
          return `Dados extraídos (${res.source}): ${JSON.stringify(res.data)}`;
        } catch (e) {
          return `Erro ao extrair: ${e}`;
        }
      }
    });
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  // ---- PLANNING ----
  private planTask(goal: string): AgentStep[] {
    const steps: AgentStep[] = [];
    const lower = goal.toLowerCase();

    // Heuristic planning based on keywords
    if (lower.includes('calcul') || lower.includes('quanto') || lower.includes('soma')) {
      steps.push(this.createStep('Realizar cálculo solicitado', 'calculate', goal));
    }
    if (lower.includes('naveg') || lower.includes('abr') || lower.includes('acessa')) {
      const urlMatch = goal.match(/(https?:\/\/[^\s]+|[\w-]+\.[a-z]{2,})/i);
      steps.push(this.createStep('Navegar para o destino', 'navigateBrowser', urlMatch?.[0] || goal));
      steps.push(this.createStep('Analisar visualmente a página', 'readScreen', ''));
    }
    if (lower.includes('veja') || lower.includes('olhe') || lower.includes('analise') || lower.includes('print')) {
      steps.push(this.createStep('Capturar e analisar tela', 'readScreen', ''));
    }
    if (lower.includes('clique') || lower.includes('pressione') || lower.includes('click')) {
      steps.push(this.createStep('Clicar no elemento especificado', 'clickByText', goal));
    }
    if (lower.includes('preencher') || lower.includes('formulário') || lower.includes('form')) {
      steps.push(this.createStep('Preencher formulário', 'fillForm', goal));
    }
    if (lower.includes('extrair') || lower.includes('coletar') || lower.includes('dados')) {
      steps.push(this.createStep('Extrair dados da página', 'extractData', goal));
    }
    if (lower.includes('powershell') || lower.includes('comando') || lower.includes('shell')) {
      steps.push(this.createStep('Executar comando no sistema', 'executeShell', goal));
    }
    if (lower.includes('buscar') || lower.includes('pesquisar') || lower.includes('encontrar')) {
      steps.push(this.createStep('Buscar na base de conhecimento', 'searchKnowledge', goal));
    }

    // Default: search knowledge
    if (steps.length === 0) {
      steps.push(this.createStep('Buscar contexto relevante', 'searchKnowledge', goal));
      steps.push(this.createStep('Processar resultado', 'calculate', '0'));
    }

    return steps;
  }

  private createStep(description: string, tool: ToolName, input: string): AgentStep {
    return {
      id: this.generateId(),
      description,
      tool,
      input,
      status: 'pending',
      timestamp: new Date()
    };
  }

  // ---- MAIN AGENT LOOP ----
  async run(goal: string): Promise<AgentTask> {
    const task: AgentTask = {
      id: this.generateId(),
      goal,
      status: 'planning',
      steps: [],
      createdAt: new Date()
    };

    this.tasks.unshift(task);
    this.notify(task);

    try {
      // PLAN
      task.steps = this.planTask(goal);
      task.status = 'executing';
      this.memory.push(`Objetivo: ${goal}`);
      this.notify(task);

      // ACT - execute each step
      const results: string[] = [];
      for (const step of task.steps) {
        step.status = 'running';
        this.notify(task);

        const tool = this.tools.get(step.tool as ToolName);
        if (!tool) {
          step.status = 'failed';
          step.output = 'Ferramenta não encontrada.';
          continue;
        }

        try {
          // OBSERVE - execute tool with timeout
          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout de 30s')), 30000)
          );
          step.output = await Promise.race([tool.execute(step.input, { goal, memory: this.memory }), timeoutPromise]);
          step.status = 'done';
          results.push(step.output);
          this.memory.push(`Resultado de ${step.tool}: ${step.output?.slice(0, 200)}`);
        } catch (e: any) {
          step.status = 'failed';
          step.output = `Erro: ${e.message}`;
          this.memory.push(`Falha em ${step.tool}: ${e.message}`);
        }

        this.notify(task);
        await new Promise(r => setTimeout(r, 500)); // Delay between steps
      }

      // REFLECT
      task.result = results.join(' | ') || 'Tarefa concluída sem resultados.';
      task.status = 'completed';
      task.completedAt = new Date();

    } catch (e: any) {
      task.status = 'error';
      task.error = e.message;
    }

    this.notify(task);
    return task;
  }

  // ---- TASK MANAGEMENT ----
  getTasks(): AgentTask[] { return this.tasks; }
  getTask(id: string): AgentTask | undefined { return this.tasks.find(t => t.id === id); }
  clearCompleted() { this.tasks = this.tasks.filter(t => t.status !== 'completed'); this.saveTasksToStorage(); }
  getMemory(): string[] { return this.memory; }
  clearMemory() { this.memory = []; }

  getAvailableTools(): { name: ToolName; description: string }[] {
    return Array.from(this.tools.values()).map(t => ({ name: t.name, description: t.description }));
  }

  private saveTasksToStorage() {
    try {
      const toSave = this.tasks.slice(0, 20); // Keep last 20
      localStorage.setItem('chico_agent_tasks', JSON.stringify(toSave));
    } catch {}
  }

  private loadTasksFromStorage() {
    try {
      const saved = localStorage.getItem('chico_agent_tasks');
      if (saved) this.tasks = JSON.parse(saved);
    } catch {}
  }
}

export const agentService = new AgentService();