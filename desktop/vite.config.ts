// Keep the regular web Vite configuration as the single source of truth.
// Desktop removes only the web service worker (all files ship inside Tauri).
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import webConfig from '../vite.config';

const PWA_MODULE = '\0desktop:pwa-register-react';

// The hook remains callable, but never registers a service worker or polls for
// web deployments. Desktop updates are delivered as new native installers.
function desktopPwaStub(): Plugin {
  return {
    name: 'desktop-no-service-worker',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:pwa-register/react') return PWA_MODULE;
    },
    load(id) {
      if (id !== PWA_MODULE) return;
      return `
        import { useState } from 'react';
        export function useRegisterSW() {
          const [needsRefresh, setNeedsRefresh] = useState(false);
          const [offlineReady, setOfflineReady] = useState(false);
          return {
            needRefresh: [needsRefresh, setNeedsRefresh],
            offlineReady: [offlineReady, setOfflineReady],
            updateServiceWorker: async () => {},
          };
        }
      `;
    },
  };
}

// Inject before the upstream React entry so every synthetic Blob download
// uses Windows Save As, without patching the website's export code.
function desktopSaveDialogEntry(): Plugin {
  return {
    name: 'desktop-native-save-dialog',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: '/desktop/nativeEntry.ts' },
          injectTo: 'head-prepend' as const,
        },
      ];
    },
  };
}

function withoutPwa(plugins: PluginOption[]): PluginOption[] {
  return plugins.flatMap((plugin) => {
    if (Array.isArray(plugin)) return withoutPwa(plugin);
    if (
      plugin &&
      typeof plugin === 'object' &&
      'name' in plugin &&
      typeof plugin.name === 'string' &&
      plugin.name.startsWith('vite-plugin-pwa')
    ) {
      return [];
    }
    return [plugin];
  });
}

export default defineConfig({
  ...webConfig,
  // Absolute URLs already used by the app resolve against Tauri's local origin.
  base: '/',
  // Reuse upstream transforms, chunks, asset handling and content routes.
  plugins: [desktopPwaStub(), desktopSaveDialogEntry(), ...withoutPwa(webConfig.plugins ?? [])],
  // The self-hosted build path omits cloud sign-in checks and analytics.
  // Explicit define keeps this behavior when run outside GitHub Actions.
  define: {
    ...webConfig.define,
    'import.meta.env.VITE_SELF_HOSTED': JSON.stringify('1'),
  },
  server: {
    ...webConfig.server,
    port: 5173,
    strictPort: true,
  },
});
