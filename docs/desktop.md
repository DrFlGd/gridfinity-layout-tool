# Offline desktop application (Tauri 2)

This fork adds a **thin native shell** around the same React/Vite application used
by the upstream website. The website continues to use `vite.config.ts`;
the desktop uses `desktop/vite.config.ts`, which inherits its transforms, WASM
asset handling, chunk graph and content routes. The only desktop-specific
behavior is to disable the website's PWA service worker and build as
`VITE_SELF_HOSTED=1` (no analytics, ML telemetry or cloud sign-in probe).

The **bundled** application runs without a web server or an internet connection
after installation. The normal planner, bin and baseplate designers, local
layout storage/import/export and STL/STEP/3MF generation come from the same
frontend as the website. Cloud sharing, sign-in and sync, community features,
collaboration and phone scanning still require the upstream cloud API and
are unavailable in self-hosted mode. External links and optional online fonts
also require a connection. Local data stays in the Tauri webview's own
IndexedDB/localStorage profile: it is *not* shared with the website or PWA.
Export a layout archive from the browser and import it in the desktop app to
migrate your layouts.

## Local development

Install Node.js 24+, pnpm 11+, Rust and the platform dependencies listed in
[Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/). At the
repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm desktop:icons
pnpm dlx @tauri-apps/cli@2 dev
```

The icon command generates native `.ico`/`.icns` variants from the *existing*
`public/icons/icon-512.png` without checking binary copies into Git.
Desktop web assets can be generated separately with `pnpm desktop:build`.
For a native installer, run `pnpm dlx @tauri-apps/cli@2 build` after generating
icons. You need internet connectivity to **build** (download Rust/JS deps)
and to **download** an installer, but not to use the installed application.

The Tauri config reads `version` from the root `package.json` so upstream
version bumps propagate automatically. COOP/COEP response headers on the
bundled protocol match the website's requirement for WASM/worker isolation.
The native app deliberately adds no filesystem, shell or HTTP Tauri plugins;
exports use existing browser download behavior. Platform webview behavior
can differ, so exercise geometry exporters on each OS before distribution.

## Releases

`.github/workflows/desktop.yml` checks all four desktop build targets on pull requests and builds
Windows NSIS, macOS DMG (ARM + Intel), and Linux DEB/AppImage on changes
to the desktop integration on `main`. Once all four jobs succeed,
the workflow publishes the draft `desktop-v<package version>` GitHub Release.
`workflow_dispatch` can also initiate a build from `main` when upstream web
content changes; bump `package.json` before publishing a *new* desktop
version. This uses a separate tag namespace from upstream web releases.
Windows installers include the offline WebView2 installer (larger download).
macOS packages are not notarized without signing credentials; users may
encounter Gatekeeper warnings until code signing is configured.

Native builds require GitHub-hosted runners and cannot be verified solely by
reviewing the sources. Always check all build jobs before treating a release as
ready. No in-app auto-updater is enabled; install a newer desktop release
manually when desired.
