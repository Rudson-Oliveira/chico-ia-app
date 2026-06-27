// Utilitarios puros extraidos do App.tsx (monolito) para reduzir o componente
// e permitir reuso/teste isolado.

/** Converte um Blob para Data URL (ex.: "data:image/png;base64,...."). */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/** Converte um Blob/File para a string base64 crua (sem o prefixo data URL). */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      } else {
        reject(new Error('Failed to convert blob to base64 string.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/** Notifica a extensao (iframe pai) sobre o status do microfone. */
export function enviarStatusParaExtensao(status: boolean) {
  try {
    if (window?.parent) {
      window.parent.postMessage({ type: 'CHICO_MIC_STATUS', on: status }, '*');
      console.log('Status do microfone enviado:', status);
    }
  } catch (e) {
    console.warn('Não foi possível enviar status para extensão:', e);
  }
}
