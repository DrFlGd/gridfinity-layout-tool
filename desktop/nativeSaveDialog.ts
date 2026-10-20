/**
 * Desktop-only bridge for the web app's existing Blob download anchors.
 *
 * The upstream exporters synchronously click a temporary <a download> then
 * revoke its object URL. Capture the Blob synchronously so a native Save As
 * dialog can be shown without racing that revocation. This module is loaded
 * only by the desktop Vite entry; the website is unaffected.
 */
type NativeInvoke = (
  command: string,
  payload: Uint8Array,
  options: { headers: Record<string, string> }
) => Promise<boolean>;

export function installNativeSaveDialog(): () => void {
  const tauriWindow = window as Window & {
    __TAURI__?: { core?: { invoke: NativeInvoke } };
  };
  const invoke = tauriWindow.__TAURI__?.core?.invoke;
  if (!invoke) return () => {};

  const blobs = new Map<string, Blob>();
  const createObjectURL = URL.createObjectURL.bind(URL);
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  // eslint-disable-next-line @typescript-eslint/unbound-method -- called with the original anchor via .call(this).
  const click = HTMLAnchorElement.prototype.click;

  URL.createObjectURL = function (object: Blob | MediaSource): string {
    const url = createObjectURL.call(URL, object);
    if (object instanceof Blob) blobs.set(url, object);
    return url;
  };

  URL.revokeObjectURL = function (url: string): void {
    blobs.delete(url);
    revokeObjectURL.call(URL, url);
  };

  HTMLAnchorElement.prototype.click = function (): void {
    const blob = this.hasAttribute('download') ? blobs.get(this.href) : undefined;
    if (!blob) {
      click.call(this);
      return;
    }

    // Hold the Blob itself, not the URL. Existing exporters revoke the URL
    // immediately after click() returns.
    const fileName = this.download || 'export.bin';
    void blob
      .arrayBuffer()
      .then((data) =>
        invoke('save_export', new Uint8Array(data), {
          headers: { 'x-file-name': encodeURIComponent(fileName) },
        })
      )
      .catch((error: unknown) => {
        console.error('Desktop file export failed:', error);
        window.alert(`Could not save ${fileName}: ${String(error)}`);
      });
  };

  return () => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    HTMLAnchorElement.prototype.click = click;
    blobs.clear();
  };
}
