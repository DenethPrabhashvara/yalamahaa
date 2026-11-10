import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', () => ({
  useCallback: (callback) => callback,
  useEffect: (effect) => { effect(); },
  useState: (initial) => {
    let value = typeof initial === 'function' ? initial() : initial;
    return [value, (next) => { value = typeof next === 'function' ? next(value) : next; }];
  },
}));

describe('saved API cache lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not repopulate the cache when a request finishes after clearing saved data', async () => {
    const api = await import('../src/api/reservoirs.js');
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const load = vi.fn(() => pending);

    api.useApiData('farm:old-user', load);
    api.clearSavedData();
    finish(['old user data']);
    await pending;
    await Promise.resolve();

    const nextLoad = vi.fn().mockResolvedValue(['fresh data']);
    api.useApiData('farm:old-user', nextLoad);
    expect(nextLoad).toHaveBeenCalledOnce();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('cancels a pending localStorage write when saved data is cleared', async () => {
    const api = await import('../src/api/reservoirs.js');

    api.useApiData('rivers', () => Promise.resolve(['river']));
    await Promise.resolve();
    await Promise.resolve();
    api.clearSavedData();
    await vi.advanceTimersByTimeAsync(1000);

    expect(localStorage.removeItem).toHaveBeenCalledWith('ym-api-cache');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
