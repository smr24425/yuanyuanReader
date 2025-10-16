/// <reference types="vite/client" />

declare module "virtual:pwa-register" {
  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  };

  export function registerSW(
    options?: RegisterSWOptions
  ): (reloadPage?: boolean) => void;
}

declare const __APP_VERSION__: string;
