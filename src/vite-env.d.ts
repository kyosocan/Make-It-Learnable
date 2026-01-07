/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT: string
  readonly VITE_APP_ID: string
  readonly VITE_APP_KEY: string
  readonly VITE_TOS_AK: string
  readonly VITE_TOS_SK: string
  readonly VITE_TOS_REGION: string
  readonly VITE_TOS_ENDPOINT: string
  readonly VITE_TOS_BUCKET: string
  readonly VITE_BASE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

