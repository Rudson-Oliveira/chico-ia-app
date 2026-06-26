/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTO_EMAIL?: string;
  readonly VITE_AUTO_PASSWORD?: string;
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
