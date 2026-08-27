import { vi } from 'vitest';

export const defaultManifest = {
  version: 'test-version',
  canonicalRawBase: 'https://raw.example.test/assets/',
  brands: [
    {
      id: 'alpha',
      name: 'Alpha Brand',
      type: 'Master',
      path: 'assets/img/alpha/',
      description: 'Alpha description',
      accent: '#123456',
      assets: [
        { label: 'Primary logo', role: 'primary', format: 'svg', path: 'assets/img/alpha/logo.svg' },
        { label: 'Directory', role: 'source', format: 'repo' },
      ],
    },
    {
      id: 'beta',
      name: 'Beta Brand',
      type: 'Product',
      path: 'assets/img/beta/',
      description: 'Beta description',
      assets: [
        { label: 'Icon', role: 'app-icon', format: 'png', path: 'assets/img/beta/icon.png' },
      ],
    },
  ],
};

const markup = `<div id="brand-grid"></div>
<div id="asset-list"></div>
<input id="asset-filter">
<span id="manifest-version"></span>
<span id="brand-count"></span>
<div id="progress"></div>
<code id="raw-path">https://raw.example.test/path</code>
<button id="copy-path">Kopieren</button>`;

export async function loadBrandJs({ fetchImpl, manifest = defaultManifest, clipboard } = {}) {
  document.body.innerHTML = markup;
  const fetch = fetchImpl || vi.fn(async () => ({
    ok: true,
    json: async () => structuredClone(manifest),
  }));
  globalThis.fetch = fetch;
  if (clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });
  }
  vi.resetModules();
  await import('../../brand.js');
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { fetch };
}
