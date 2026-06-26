// ============================================================
// VISION SERVICE - Captura de Tela, Camera e OCR
// ============================================================

export type CaptureType = 'screen' | 'camera' | null;

export interface VisionState {
  isCapturing: boolean;
  captureType: CaptureType;
  lastFrame: string | null; // base64
  error: string | null;
}

class VisionService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private state: VisionState = {
    isCapturing: false,
    captureType: null,
    lastFrame: null,
    error: null
  };
  private onStateChange?: (state: VisionState) => void;

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
    }
  }

  onUpdate(cb: (state: VisionState) => void) {
    this.onStateChange = cb;
  }

  private notify() {
    this.onStateChange?.({ ...this.state });
  }

  getState(): VisionState {
    return { ...this.state };
  }

  // Attach existing video element from the UI
  attachVideoElement(video: HTMLVideoElement) {
    this.videoElement = video;
  }

  // Start screen capture using getDisplayMedia
  async startScreenCapture(): Promise<boolean> {
    try {
      this.state.error = null;
      // @ts-ignore - getDisplayMedia may not be in all TS defs
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      await this.attachStream(mediaStream, 'screen');
      return true;
    } catch (e: any) {
      this.state.error = `Erro ao capturar tela: ${e.message}`;
      this.notify();
      return false;
    }
  }

  // Start camera capture
  async startCameraCapture(): Promise<boolean> {
    try {
      this.state.error = null;
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });

      await this.attachStream(mediaStream, 'camera');
      return true;
    } catch (e: any) {
      this.state.error = `Erro ao acessar camera: ${e.message}`;
      this.notify();
      return false;
    }
  }

  private async attachStream(mediaStream: MediaStream, type: CaptureType): Promise<void> {
    this.stopCapture();
    this.stream = mediaStream;

    if (this.videoElement) {
      this.videoElement.srcObject = mediaStream;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      try { await this.videoElement.play(); } catch {}
    }

    // Listen for stream end (user stops sharing)
    mediaStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.stopCapture();
    });

    this.state.isCapturing = true;
    this.state.captureType = type;
    this.notify();
  }

  // Stop all captures
  stopCapture(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.state.isCapturing = false;
    this.state.captureType = null;
    this.state.lastFrame = null;
    this.notify();
  }

  // Capture current frame as base64 PNG
  captureFrame(video?: HTMLVideoElement): string | null {
    const vid = video || this.videoElement;
    if (!vid || !this.canvas) return null;
    if (vid.readyState < 2) return null; // Not loaded

    this.canvas.width = vid.videoWidth || 640;
    this.canvas.height = vid.videoHeight || 480;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(vid, 0, 0, this.canvas.width, this.canvas.height);
    const base64 = this.canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    this.state.lastFrame = base64;
    return base64;
  }

  // Auto-capture frame from current stream
  getCurrentFrame(): string | null {
    if (!this.state.isCapturing) return null;
    return this.captureFrame();
  }

  // OCR - returns text found in image
  async extractText(base64Image: string): Promise<string> {
    if (!base64Image) return 'Nenhuma imagem disponivel.';
    try {
      // We can use Gemini for OCR too
      const { sendTextMessage } = await import('./geminiService');
      const response = await sendTextMessage(
        "Extraia todo o texto desta imagem (OCR). Retorne apenas o texto encontrado.",
        [],
        'default',
        { base64: base64Image, mimeType: 'image/jpeg' },
        true
      );
      return response.text || 'Nenhum texto detectado.';
    } catch (e) {
      return `Erro no OCR: ${e}`;
    }
  }

  // Describe what is on screen using base64 image
  async analyzeFrame(base64Image: string): Promise<string> {
    if (!base64Image) return 'Nenhuma imagem para analisar.';
    try {
      const { sendTextMessage } = await import('./geminiService');
      const response = await sendTextMessage(
        "Descreva o que você está vendo nesta imagem de forma técnica e detalhada para um assistente de automação.",
        [],
        'default',
        { base64: base64Image, mimeType: 'image/jpeg' },
        true
      );
      return response.text || 'Não foi possível analisar a imagem.';
    } catch (e) {
      return `Erro na análise visual: ${e}`;
    }
  }

  isActive(): boolean {
    return this.state.isCapturing;
  }
}

export const visionService = new VisionService();
