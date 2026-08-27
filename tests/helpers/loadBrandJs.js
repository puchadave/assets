import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const sourcePath = resolve(process.cwd(), 'brand.js');
const source = readFileSync(sourcePath, 'utf8');
let coverageLoaded = false;

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

const markup = `<!doctype html>
<html><body>
  <div id="brand-grid"></div>
  <div id="asset-list"></div>
  <input id="asset-filter">
  <span id="manifest-version"></span>
  <span id="brand-count"></span>
  <div id="progress"></div>
  <code id="raw-path">https://raw.example.test/path</code>
  <button id="copy-path">Kopieren</button>
</body></html>`;

export async function loadBrandJs({ fetchImpl, manifest = defaultManifest, consoleError } = {}) {
  const dom = new JSDOM(markup, {
    runScripts: 'dangerously',
    url: 'https://example.test/',
  });
  const fetch = fetchImpl || (async () => ({ ok: true, json: async () => manifest }));
  dom.window.fetch = fetch;
  if (consoleError) dom.window.console.error = consoleError;
  if (!coverageLoaded) {
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.fetch = fetch;
    await import('../../brand.js?coverage');
    coverageLoaded = true;
  }
  dom.window.eval(`${source}\n//# sourceURL=${sourcePath}`);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}
