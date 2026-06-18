/// <reference types="vite/client" />

declare module 'vite-plugin-dom-inspector' {
  export function meuDomInspectorPlugin(): import('vite').Plugin;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
