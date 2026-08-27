import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultManifest, loadBrandJs } from './helpers/loadBrandJs.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('brand portal helpers', () => {
  let dom;
  let window;

  beforeEach(async () => {
    dom = await loadBrandJs();
    window = dom.window;
  });

  it('escapes all HTML-sensitive characters and stringifies values', () => {
    expect(window.esc(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
    expect(window.esc(undefined)).toBe('');
    expect(window.esc(null)).toBe('null');
    expect(window.esc(42)).toBe('42');
  });

  it('creates initials from words and truncates to two characters', () => {
    expect(window.initials('Alpha Beta Gamma')).toBe('AB');
    expect(window.initials('a.b_c-d')).toBe('AB');
    expect(window.initials('')).toBe('•');
    expect(window.initials()).toBe('•');
  });

  it('builds repository and raw asset URLs', () => {
    expect(window.repoPath('assets/img/alpha/')).toBe(
      'https://github.com/puchadave/assets/tree/main/assets/img/alpha/',
    );
    expect(window.rawAsset('logo.svg')).toBe('https://raw.example.test/assets/logo.svg');
  });

  it('falls back to the default raw asset base when the manifest omits it', async () => {
    window.fetch = async () => ({
      ok: true,
      json: async () => ({ ...defaultManifest, canonicalRawBase: undefined }),
    });
    await window.loadManifest();
    expect(window.rawAsset('logo.svg')).toBe(
      'https://raw.githubusercontent.com/puchadave/assets/main/logo.svg',
    );
  });

  it('renders fallback marks with escaped names', () => {
    expect(window.fallbackMark({ name: '<Danger>' })).toContain('&lt;Danger&gt;');
    expect(window.fallbackMark({ name: 'Alpha Beta' })).toContain('<i>AB</i>');
  });
});

describe('brand rendering', () => {
  it('renders cards, accents, primary logos, fallback cards, and card clicks', async () => {
    const manifest = {
      ...defaultManifest,
      brands: [
        defaultManifest.brands[0],
        { ...defaultManifest.brands[1], assets: [] },
      ],
    };
    const dom = await loadBrandJs({ manifest });
    const { document } = dom.window;
    expect(document.getElementById('brand-count').textContent).toBe('2');
    expect(document.querySelector('.brand-card[style*="--brand-accent"]')).not.toBeNull();
    expect(document.querySelector('.brand-logo').src).toBe('https://raw.example.test/assets/assets/img/alpha/logo.svg');
    expect(document.querySelector('.mark-fallback')).not.toBeNull();

    const filter = document.getElementById('asset-filter');
    document.querySelector('[data-brand="alpha"]').click();
    expect(filter.value).toBe('alpha');
    expect(document.querySelectorAll('.asset-row')).toHaveLength(2);
  });

  it('replaces a broken primary image with the brand fallback', async () => {
    const dom = await loadBrandJs();
    const image = dom.window.document.querySelector('.brand-logo');
    const mark = image.closest('.mark');
    image.dispatchEvent(new dom.window.Event('error'));
    expect(mark.innerHTML).toContain('<i>AB</i>');
    expect(mark.querySelector('img')).toBeNull();
  });

  it('flattens brands with and without assets', async () => {
    const dom = await loadBrandJs({
      manifest: {
        ...defaultManifest,
        brands: [{ ...defaultManifest.brands[0], assets: [] }],
      },
    });
    expect(dom.window.flattenAssets()).toEqual([]);
  });

  it('renders an empty state and filters across all searchable fields', async () => {
    const dom = await loadBrandJs();
    const { document, renderAssets } = dom.window;
    renderAssets('does-not-exist');
    expect(document.getElementById('asset-list').textContent).toContain('Keine passenden Assets');
    for (const needle of ['beta brand', 'beta', 'source', 'png', 'icon.png', 'primary logo']) {
      renderAssets(needle);
      expect(document.querySelectorAll('.asset-row')).toHaveLength(1);
    }
  });

  it('uses raw links for files and repository links for directory entries', async () => {
    const dom = await loadBrandJs();
    const links = [...dom.window.document.querySelectorAll('.asset-row a')];
    expect(links[0].href).toBe('https://raw.example.test/assets/assets/img/alpha/logo.svg');
    expect(links[1].href).toBe('https://github.com/puchadave/assets/tree/main/assets/img/alpha/');
  });

  it('escapes hostile labels and paths as text and attributes', async () => {
    const hostile = {
      ...defaultManifest,
      brands: [{
        ...defaultManifest.brands[0],
        name: '<img onerror=alert(1)>',
        assets: [{ label: '<img onerror=alert(2)>', role: 'x', format: 'svg', path: '"><script>alert(3)</script>' }],
      }],
    };
    const dom = await loadBrandJs({ manifest: hostile });
    expect(dom.window.document.querySelectorAll('script')).toHaveLength(0);
    expect(dom.window.document.getElementById('asset-list').innerHTML).not.toContain('<img');
    expect(dom.window.document.getElementById('asset-list').textContent).toContain('<img onerror=alert(2)>');
  });
});

describe('manifest loading and interaction handlers', () => {
  it('loads a manifest, updates version, and renders both views', async () => {
    const dom = await loadBrandJs();
    expect(dom.window.document.getElementById('manifest-version').textContent).toBe('manifest test-version');
    expect(dom.window.document.querySelectorAll('.brand-card')).toHaveLength(2);
    expect(dom.window.document.querySelectorAll('.asset-row')).toHaveLength(3);
  });

  it('renders German error states for unsuccessful and thrown requests', async () => {
    const error = vi.fn();
    const unsuccessful = await loadBrandJs({
      fetchImpl: async () => ({ ok: false, status: 503 }),
      consoleError: error,
    });
    expect(unsuccessful.window.document.getElementById('brand-grid').textContent).toContain(
      'Brand-Manifest nicht verfügbar',
    );
    expect(unsuccessful.window.document.getElementById('asset-list').textContent).toContain(
      'Manifest konnte nicht geladen werden.',
    );

    const thrown = await loadBrandJs({
      fetchImpl: async () => { throw new Error('offline'); },
      consoleError: error,
    });
    expect(thrown.window.document.getElementById('brand-grid').textContent).toContain(
      'Brand-Manifest nicht verfügbar',
    );
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('filters on input and copies the raw path, including clipboard rejection', async () => {
    const dom = await loadBrandJs();
    vi.useFakeTimers();
    const { document, navigator } = dom.window;
    const filter = document.getElementById('asset-filter');
    filter.value = 'beta';
    filter.dispatchEvent(new dom.window.Event('input'));
    expect(document.querySelectorAll('.asset-row')).toHaveLength(1);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const button = document.getElementById('copy-path');
    const currentTarget = Object.getOwnPropertyDescriptor(dom.window.Event.prototype, 'currentTarget');
    Object.defineProperty(dom.window.Event.prototype, 'currentTarget', {
      configurable: true,
      get: () => button,
    });
    button.dispatchEvent(new dom.window.Event('click'));
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://raw.example.test/path');
    expect(button.textContent).toBe('Kopiert');
    vi.advanceTimersByTime(1200);
    expect(button.textContent).toBe('Kopieren');

    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('denied'));
    button.dispatchEvent(new dom.window.Event('click'));
    await Promise.resolve();
    await Promise.resolve();
    expect(button.textContent).toBe('Kopieren');
    Object.defineProperty(dom.window.Event.prototype, 'currentTarget', currentTarget);
    vi.useRealTimers();
  });

  it('updates scroll progress with and without scrollable content', async () => {
    const dom = await loadBrandJs();
    Object.defineProperty(dom.window.document.documentElement, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 500 });
    Object.defineProperty(dom.window, 'scrollY', { configurable: true, value: 250 });
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
    expect(dom.window.document.getElementById('progress').style.width).toBe('50%');
    Object.defineProperty(dom.window.document.documentElement, 'scrollHeight', { configurable: true, value: 500 });
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
    expect(dom.window.document.getElementById('progress').style.width).toBe('0%');
  });

  it('tracks pointer coordinates in CSS custom properties', async () => {
    const dom = await loadBrandJs();
    const event = new dom.window.Event('pointermove');
    Object.defineProperties(event, { clientX: { value: 12 }, clientY: { value: 34 } });
    dom.window.dispatchEvent(event);
    expect(dom.window.document.documentElement.style.getPropertyValue('--mx')).toBe('12px');
    expect(dom.window.document.documentElement.style.getPropertyValue('--my')).toBe('34px');
  });
});
