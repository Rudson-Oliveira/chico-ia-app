// ============================================================
// SHELL SERVICE - Executor PowerShell Seguro com Allowlist
// ============================================================

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
  timestamp: string;
}

export interface ShellLog {
  command: string;
  result: ShellResult;
  timestamp: string;
}

class ShellService {
  private readonly DEFAULT_ALLOWLIST = [
    'Get-Process', 'Get-Service', 'Get-Date', 'Get-ChildItem',
    'Get-ComputerInfo', 'Test-Connection', 'Get-EventLog',
    'dir', 'ls', 'pwd', 'echo', 'whoami', 'hostname',
    'ipconfig', 'ping', 'netstat', 'tasklist', 'systeminfo',
    'Get-Disk', 'Get-Volume', 'Get-NetAdapter', 'Get-NetIPAddress'
  ];

  private logs: ShellLog[] = [];
  private readonly STORAGE_KEY = 'chico_shell_logs';
  private readonly API_ENDPOINT = '/api/shell';

  // Mock responses for development/offline mode
  private mockResponses: Record<string, string> = {
    'Get-Date': `Terça-feira, 07 de Abril de 2026 12:00:00`,
    'Get-Process': `NPM(K) PM(M) WS(M) CPU(s) Id SI ProcessName\n------ ----- ----- ------ -- -- -----------\n0 0.01 0.04 0.00 4 0 Idle\n 16 1.45 7.73 9.88 1420 1 explorer\n 19 2.11 9.34 0.05 3120 1 node`,
    'Get-ComputerInfo': `WindowsProductName : Windows 11 Pro\nTotalPhysicalMemory: 16 GB\nCsName: CHICO-PC`,
    'Get-Service': `Status Name DisplayName\n------ ---- -----------\nRunning AudioSrv Windows Audio\nRunning BITS Background Intelligent Transfer\nRunning EventLog Windows Event Log`,
    'pwd': `C:\\Users\\Rudson\\Projects\\HospitaLar`,
    'whoami': `CHICO-PC\\Rudson`,
    'hostname': `CHICO-PC`,
    'ipconfig': `Adaptador Ethernet:\n Endere\u00e7o IP: 192.168.1.100\n M\u00e1scara de Sub-rede: 255.255.255.0\n Gateway Padr\u00e3o: 192.168.1.1`,
    'dir': `Volume em C sem nome\n Diret\u00f3rio: C:\\Users\\Rudson\\Projects\\HospitaLar\n17/03/2026 src\n17/03/2026 node_modules\n07/04/2026 package.json\n07/04/2026 README.md`,
    'tasklist': `Image Name PID Session# Mem Usage\nSystem Idle Process 0 Services 8 K\nexplorer.exe 1420 Console 75,320 K\nnode.exe 3120 Console 128,456 K`,
  };

  constructor() {
    this.loadLogsFromStorage();
  }

  isAllowed(cmd: string, customAllowlist?: string[]): boolean {
    const list = customAllowlist || this.DEFAULT_ALLOWLIST;
    const baseCmd = cmd.trim().split(/\s+/)[0];
    return list.some(allowed =>
      baseCmd.toLowerCase() === allowed.toLowerCase()
    );
  }

  async executeCommand(cmd: string, customAllowlist?: string[]): Promise<ShellResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!this.isAllowed(cmd, customAllowlist)) {
      const result: ShellResult = {
        command: cmd,
        stdout: '',
        stderr: `Comando não permitido: "${cmd.split(' ')[0]}". Use apenas comandos da lista permitida.`,
        exitCode: 1,
        duration: 0,
        timestamp
      };
      this.logCommand(cmd, result);
      return result;
    }

    // Try real API first, fall back to mock
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const result: ShellResult = {
          command: cmd,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          exitCode: data.exitCode ?? 0,
          duration: Date.now() - startTime,
          timestamp
        };
        this.logCommand(cmd, result);
        return result;
      }
    } catch {
      // API not available, use mock
    }

    // Mock response
    return this.getMockResult(cmd, startTime, timestamp);
  }

  private getMockResult(cmd: string, startTime: number, timestamp: string): ShellResult {
    const baseCmd = cmd.trim().split(/\s+/)[0];
    const mockKey = Object.keys(this.mockResponses).find(
      k => k.toLowerCase() === baseCmd.toLowerCase()
    );

    const stdout = mockKey
      ? this.mockResponses[mockKey]
      : `[MODO DEMO] Comando "${cmd}" executado com sucesso.\nInstale o servidor PowerShell em /api/shell para execução real.`;

    const result: ShellResult = {
      command: cmd,
      stdout,
      stderr: '',
      exitCode: 0,
      duration: Date.now() - startTime,
      timestamp
    };

    this.logCommand(cmd, result);
    return result;
  }

  private logCommand(cmd: string, result: ShellResult): void {
    const log: ShellLog = {
      command: cmd,
      result,
      timestamp: new Date().toISOString()
    };
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs = this.logs.slice(0, 100);
    this.saveLogsToStorage();
  }

  getLogs(): ShellLog[] { return this.logs; }
  clearLogs(): void { this.logs = []; this.saveLogsToStorage(); }
  getAllowlist(): string[] { return [...this.DEFAULT_ALLOWLIST]; }

  private saveLogsToStorage(): void {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs.slice(0, 50))); } catch {}
  }

  private loadLogsFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) this.logs = JSON.parse(saved);
    } catch { this.logs = []; }
  }
}

export const shellService = new ShellService();
