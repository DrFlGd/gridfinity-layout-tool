// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installNativeSaveDialog } from './nativeSaveDialog';

type DesktopTestWindow = Window & {
  __TAURI__?: {
    core: {
      invoke: ReturnType<typeof vi.fn>;
    };
  };
};

const desktopWindow = window as DesktopTestWindow;
let cleanup: () => void;
let invoke: ReturnType<typeof vi.fn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let nativeClick: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  invoke = vi.fn().mockResolvedValue(true);
  desktopWindow.__TAURI__ = { core: { invoke } };
  createObjectURL = vi.fn().mockReturnValue('blob:desktop-export');
  revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
  nativeClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  cleanup = installNativeSaveDialog();
});

afterEach(() => {
  cleanup();
  nativeClick.mockRestore();
  delete desktopWindow.__TAURI__;
  vi.unstubAllGlobals();
});

describe('desktop Save As bridge', () => {
  it('keeps export bytes available even if the URL is revoked immediately', async () => {
    const bytes = new Uint8Array([0, 1, 255]);
    const blob = new Blob([bytes]);
    Object.defineProperty(blob, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(bytes.buffer),
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'drawer ölçü.stl';
    anchor.click();
    URL.revokeObjectURL(url);

    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith('save_export', bytes, {
      headers: { 'x-file-name': encodeURIComponent('drawer ölçü.stl') },
    });
    expect(nativeClick).not.toHaveBeenCalled();
  });

  it('does not intercept links that are not downloads', () => {
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob(['test']));
    anchor.click();
    expect(nativeClick).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('leaves regular downloads alone if the native bridge is absent', () => {
    cleanup();
    delete desktopWindow.__TAURI__;
    cleanup = installNativeSaveDialog();
    const anchor = document.createElement('a');
    anchor.download = 'layout.json';
    anchor.href = 'blob:ordinary';
    anchor.click();
    expect(nativeClick).toHaveBeenCalledTimes(1);
  });
});
