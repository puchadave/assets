import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultManifest, loadBrandJs } from './helpers/loadBrandJs.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('brand rendering', () => {
  it('renders escaped brand names, initials, accents, and primary logo URLs', async () => {
    const manifest = {
      ...defaultManifest,
      brands: [
        defaultManifest.brands[0],
        { ...defaultManifest.brands[1], name: 'a.b_c-d', assets: [] },
        { ...defaultManifest.brands[1], id: 'dots', name: '...', assets: [] },
        {
          ...defaultManifest.brands[1],
          id: 'hostile',
          name: '<Danger>',
          description: '<script>alert(1)</script>',
          assets: [],
        },
        {
          ...defaultManifest.brands[1],
          id: 'values',
          name: 'Values',
          type: 42,
          description: null,
          path: undefined,
          assets: [{ label: null, role: null, format: null }],
        },
        {
          ...defaultManifest.brands[1],
          id: 'nameless',
          name: undefined,
          description: undefined,
          type: undefined,
          path: undefined,
          assets: [],
        },
      ],
    };
    await loadBrandJs({ manifest });
    expect(document.getElementById('brand-count').textContent).toBe('6');
    expect(document.querySelector('.brand-card[style*="--brand-accent"]')).not.toBeNull();
    expect(document.querySelector('.brand-logo').src).toBe(
      'https://raw.example.test/assets/assets/img/alpha/logo.svg',
    );
    expect(document.querySelectorAll('.mark-fallback')[0].textContent).toContain('AB');
    expect(document.querySelectorAll('.mark-fallback')[1].textContent).toContain('•');
    expect(document.querySelector('.brand-card:nth-child(4)').textContent).toContain('<Danger>');
    expect(document.querySelector('.brand-card:nth-child(4)').querySelector('script')).toBeNull();
    expect(document.querySelectorAll('.mark-fallback')[4].textContent).toBe('•');
    expect(document.querySelector('.brand-card:nth-child(5)').textContent).toContain('42');
    expect(document.querySelector('.brand-card:nth-child(5)').textContent).toContain('null');
  });

  it('renders repository source links and filters assets from brand clicks and input', async () => {
    await loadBrandJs();
    expect(document.querySelector('.brand-links a[href*="github.com"]').href).toBe(
      'https://github.com/puchadave/assets/tree/main/assets/img/alpha/',
    );
    const filter = document.getElementById('asset-filter');
    document.querySelector('[data-brand="alpha"]').click();
    expect(filter.value).toBe('alpha');
    expect(document.querySelectorAll('.asset-row')).toHaveLength(2);
    filter.value = 'beta';
    filter.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.asset-row')).toHaveLength(1);
  });

  it('replaces a broken primary image with the fallback mark', async () => {
    await loadBrandJs();
    const image = document.querySelector('.brand-logo');
    const mark = image.closest('.mark');
    image.dispatchEvent(new Event('error'));
    expect(mark.innerHTML).toContain('<i>AB</i>');
    expect(mark.querySelector('img')).toBeNull();
  });

  it('ignores image errors for unknown brand ids', async () => {
    await loadBrandJs();
    const image = document.querySelector('.brand-logo');
    image.dataset.brandId = 'missing';
    image.dispatchEvent(new Event('error'));
    expect(image.closest('.mark').querySelector('img')).toBe(image);
  });
});

describe('asset rendering', () => {
  it('renders empty states and filters across brand, role, format, path, and label', async () => {
    await loadBrandJs();
    const filter = document.getElementById('asset-filter');
    filter.value = 'does-not-exist';
    filter.dispatchEvent(new Event('input'));
    expect(document.getElementById('asset-list').textContent).toContain('Keine passenden Assets');
    for (const needle of ['beta brand', 'beta', 'source', 'png', 'icon.png', 'primary logo']) {
      filter.value = needle;
      filter.dispatchEvent(new Event('input'));
      expect(document.querySelectorAll('.asset-row')).toHaveLength(1);
    }
  });

  it('renders raw file links and repository directory links', async () => {
    await loadBrandJs();
    const links = [...document.querySelectorAll('.asset-row a')];
    expect(links[0].href).toBe('https://raw.example.test/assets/assets/img/alpha/logo.svg');
    expect(links[1].href).toBe('https://github.com/puchadave/assets/tree/main/assets/img/alpha/');
  });

  it('escapes hostile labels, paths, and attributes', async () => {
    const hostile = {
      ...defaultManifest,
      brands: [{
        ...defaultManifest.brands[0],
        name: '<img onerror=alert(1)>',
        assets: [{
          label: '<img onerror=alert(2)>',
          role: 'x',
          format: 'svg',
          path: '"><script>alert(3)</script>',
        }],
      }],
    };
    await loadBrandJs({ manifest: hostile });
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(document.getElementById('asset-list').innerHTML).not.toContain('<img');
    expect(document.getElementById('asset-list').textContent).toContain('<img onerror=alert(2)>');
  });

  it('supports brands with no assets and a missing canonical raw base', async () => {
    await loadBrandJs({
      manifest: {
        ...defaultManifest,
        canonicalRawBase: undefined,
        brands: [{
          ...defaultManifest.brands[0],
          assets: [
            { label: 'Primary logo', role: 'primary', format: 'svg', path: 'logo.svg' },
            { label: 'Directory', role: 'source', format: 'repo' },
          ],
        }],
      },
    });
    expect(document.querySelector('.brand-logo')).not.toBeNull();
    expect(document.querySelector('.brand-logo').src).toBe(
      'https://raw.githubusercontent.com/puchadave/assets/main/logo.svg',
    );
    expect(document.querySelectorAll('.asset-row')).toHaveLength(2);
    expect(document.querySelectorAll('.asset-row a')[1].href).toBe(
      'https://github.com/puchadave/assets/tree/main/assets/img/alpha/',
    );
  });
});

describe('manifest loading and interactions', () => {
  it('loads the manifest and updates version and both containers', async () => {
    await loadBrandJs();
    expect(document.getElementById('manifest-version').textContent).toBe('manifest test-version');
    expect(document.querySelectorAll('.brand-card')).toHaveLength(2);
    expect(document.querySelectorAll('.asset-row')).toHaveLength(3);
  });

  it('renders German error states and logs failed requests', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await loadBrandJs({ fetchImpl: async () => ({ ok: false, status: 503 }) });
    expect(document.getElementById('brand-grid').textContent).toContain('Brand-Manifest nicht verfügbar');
    expect(document.getElementById('asset-list').textContent).toContain('Manifest konnte nicht geladen werden.');
    await loadBrandJs({ fetchImpl: async () => { throw new Error('offline'); } });
    expect(document.getElementById('brand-grid').textContent).toContain('Brand-Manifest nicht verfügbar');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('copies the raw path, resets the label, and swallows clipboard failures', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await loadBrandJs({ clipboard: { writeText } });
    vi.useFakeTimers();
    const button = document.getElementById('copy-path');
    button.addEventListener('click', (event) => {
      Object.defineProperty(event, 'currentTarget', { configurable: true, value: button });
    }, { capture: true, once: true });
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledWith('https://raw.example.test/path');
    expect(button.textContent).toBe('Kopiert');
    vi.advanceTimersByTime(1200);
    expect(button.textContent).toBe('Kopieren');
    writeText.mockRejectedValue(new Error('denied'));
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.textContent).toBe('Kopieren');
  });

  it('updates scroll progress including the non-scrollable guard', async () => {
    await loadBrandJs();
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 250 });
    window.dispatchEvent(new Event('scroll'));
    expect(document.getElementById('progress').style.width).toBe('50%');
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 500 });
    window.dispatchEvent(new Event('scroll'));
    expect(document.getElementById('progress').style.width).toBe('0%');
  });

  it('tracks pointer coordinates in CSS custom properties', async () => {
    await loadBrandJs();
    const event = new Event('pointermove');
    Object.defineProperties(event, { clientX: { value: 12 }, clientY: { value: 34 } });
    window.dispatchEvent(event);
    expect(document.documentElement.style.getPropertyValue('--mx')).toBe('12px');
    expect(document.documentElement.style.getPropertyValue('--my')).toBe('34px');
  });
});
