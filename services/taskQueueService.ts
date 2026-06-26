// ============================================================
// TASK QUEUE SERVICE - Gerenciamento de Tarefas em Background
// ============================================================

export interface Task {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

class TaskQueueService {
  private queue: Task[] = [];
  private isRunning: boolean = false;
  private readonly STORAGE_KEY = 'chico_task_queue';

  constructor() {
    this.loadFromStorage();
  }

  addTask(type: string, payload: any) {
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      status: 'pending',
      createdAt: new Date()
    };
    this.queue.push(task);
    this.saveToStorage();
    return task;
  }

  startWorker() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processQueue();
  }

  private async processQueue() {
    while (this.isRunning) {
      const pendingTask = this.queue.find(t => t.status === 'pending');
      if (pendingTask) {
        await this.executeTask(pendingTask);
      } else {
        await new Promise(r => setTimeout(r, 2000)); // Wait for new tasks
      }
    }
  }

  private async executeTask(task: Task) {
    task.status = 'processing';
    this.saveToStorage();

    try {
      console.log(`Executando tarefa: ${task.type}`, task.payload);
      
      // Simulate task execution logic
      switch (task.type) {
        case 'sync_focoflow':
          await new Promise(r => setTimeout(r, 1000));
          break;
        case 'process_vision':
          await new Promise(r => setTimeout(r, 2000));
          break;
        default:
          console.warn(`Tipo de tarefa desconhecido: ${task.type}`);
      }

      task.status = 'completed';
    } catch (e: any) {
      task.status = 'failed';
      task.error = e.message;
    }

    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue.slice(-50)));
    } catch {}
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.queue = parsed.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt)
        }));
      }
    } catch {}
  }

  getQueue() { return [...this.queue]; }
}

export const taskQueueService = new TaskQueueService();
