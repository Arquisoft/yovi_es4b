/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAMEY_API_URL?: string
  readonly VITE_AUTH_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
