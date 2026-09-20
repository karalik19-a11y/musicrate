import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { afterEach, vi } from 'vitest';

/**
 * DOM shims for the app-level tests: happy-dom gives us a real DOM, but the
 * browser APIs the app touches (media elements, canvas painting, vibration,
 * matchMedia) are stubbed so the React tree mounts and behaves deterministically.
 */

/* happy-dom can hand a Node Blob to an <audio> element; keep it deterministic */
Object.assign(URL, {
  createObjectURL: () => `blob:musicrate/test-${Math.random().toString(36).slice(2, 8)}`,
  revokeObjectURL: () => undefined,
});

class FakeMediaElement {
  preload = '';
  currentTime = 0;
  duration = 0;
  paused = true;
  src = '';
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    // a fresh element never has metadata: `probeDuration()` resolves null
    window.setTimeout(() => this.onloadedmetadata?.(), 0);
  }

  addEventListener(type: string, fn: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: () => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  setAttribute(): void {}
  removeAttribute(): void {}
  load(): void {}

  play(): Promise<void> {
    this.paused = false;
    this.emit('playing');
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
    this.emit('pause');
  }

  emit(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
}

vi.stubGlobal('Audio', FakeMediaElement);

/* canvas: the generative covers paint through 2d; a no-op recorder is enough */
const noop = () => undefined;
function fakeContext(): Record<string, unknown> {
  const target: Record<string, unknown> = {
    canvas: { width: 512, height: 512 },
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 40 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    setTransform: noop,
    fillRect: noop,
    fillText: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    closePath: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    clip: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    roundRect: noop,
    ellipse: noop,
    drawImage: noop,
  };
  return new Proxy(target, {
    get: (obj, prop) => (prop in obj ? obj[prop] : noop),
    set: (obj, prop, value) => {
      obj[prop as string] = value;
      return true;
    },
  });
}

const HTMLCanvas = (globalThis as unknown as { HTMLCanvasElement?: { prototype: object } }).HTMLCanvasElement;
if (HTMLCanvas) {
  Object.defineProperty(HTMLCanvas.prototype, 'getContext', { value: () => fakeContext(), configurable: true });
  Object.defineProperty(HTMLCanvas.prototype, 'toDataURL', { value: () => 'data:image/png;base64,', configurable: true });
}

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: noop,
  removeListener: noop,
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: () => false,
}));

class FakeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', FakeObserver);
vi.stubGlobal('IntersectionObserver', FakeObserver);

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
if (!('vibrate' in navigator)) {
  Object.defineProperty(navigator, 'vibrate', { value: () => false, configurable: true });
}
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
}

Element.prototype.scrollTo ??= noop as never;
window.scrollTo = noop as never;

afterEach(() => {
  vi.restoreAllMocks();
});
