const runtimeComposablesMock = vi.hoisted(() => {
  const scriptPersistence = {
    hydrate: vi.fn(),
    pausePersistence: vi.fn(),
  };

  const outlinePersistence = {
    hydrate: vi.fn(),
    dispose: vi.fn(),
  };

  const worldbuildingPersistence = {
    hydrate: vi.fn(),
    dispose: vi.fn(),
  };

  const foundationPersistence = {
    hydrate: vi.fn(),
    dispose: vi.fn(),
  };

  const panelLifecycle = {
    dispose: vi.fn(),
  };

  return {
    scriptPersistence,
    outlinePersistence,
    worldbuildingPersistence,
    foundationPersistence,
    panelLifecycle,
  };
});

vi.mock('@/novelToST/composables/useScriptPersistence', () => ({
  useScriptPersistence: () => runtimeComposablesMock.scriptPersistence,
}));

vi.mock('@/novelToST/composables/useOutlinePersistence', () => ({
  useOutlinePersistence: () => runtimeComposablesMock.outlinePersistence,
}));

vi.mock('@/novelToST/composables/useWorldbuildingPersistence', () => ({
  useWorldbuildingPersistence: () => runtimeComposablesMock.worldbuildingPersistence,
}));

vi.mock('@/novelToST/composables/useFoundationPersistence', () => ({
  useFoundationPersistence: () => runtimeComposablesMock.foundationPersistence,
}));

vi.mock('@/novelToST/composables/usePanelLifecycle', () => ({
  usePanelLifecycle: () => runtimeComposablesMock.panelLifecycle,
}));

import {
  disposeNovelToSTRuntime,
  getOrCreateNovelToSTRuntime,
} from '@/novelToST/app/runtime';

describe('runtime', () => {
  beforeEach(() => {
    disposeNovelToSTRuntime();

    runtimeComposablesMock.scriptPersistence.hydrate.mockClear();
    runtimeComposablesMock.scriptPersistence.pausePersistence.mockClear();
    runtimeComposablesMock.outlinePersistence.hydrate.mockClear();
    runtimeComposablesMock.outlinePersistence.dispose.mockClear();
    runtimeComposablesMock.worldbuildingPersistence.hydrate.mockClear();
    runtimeComposablesMock.worldbuildingPersistence.dispose.mockClear();
    runtimeComposablesMock.foundationPersistence.hydrate.mockClear();
    runtimeComposablesMock.foundationPersistence.dispose.mockClear();
    runtimeComposablesMock.panelLifecycle.dispose.mockClear();
  });

  afterEach(() => {
    disposeNovelToSTRuntime();
  });

  it('should hydrate all persistence layers and reuse existing runtime instance', () => {
    const firstRuntime = getOrCreateNovelToSTRuntime();

    expect(runtimeComposablesMock.scriptPersistence.hydrate).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.outlinePersistence.hydrate).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.worldbuildingPersistence.hydrate).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.foundationPersistence.hydrate).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.foundationPersistence.hydrate.mock.invocationCallOrder[0]).toBeLessThan(
      runtimeComposablesMock.outlinePersistence.hydrate.mock.invocationCallOrder[0]!,
    );
    expect(runtimeComposablesMock.outlinePersistence.hydrate.mock.invocationCallOrder[0]).toBeLessThan(
      runtimeComposablesMock.worldbuildingPersistence.hydrate.mock.invocationCallOrder[0]!,
    );

    const secondRuntime = getOrCreateNovelToSTRuntime();
    expect(secondRuntime).toBe(firstRuntime);
    expect(runtimeComposablesMock.scriptPersistence.hydrate).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.foundationPersistence.hydrate).toHaveBeenCalledTimes(1);
  });

  it('should dispose runtime and stop all persistence/lifecycle handlers', () => {
    const runtime = getOrCreateNovelToSTRuntime();

    runtime.dispose();

    expect(runtimeComposablesMock.scriptPersistence.pausePersistence).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.panelLifecycle.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.outlinePersistence.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.worldbuildingPersistence.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.foundationPersistence.dispose).toHaveBeenCalledTimes(1);

    runtime.dispose();

    expect(runtimeComposablesMock.scriptPersistence.pausePersistence).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.foundationPersistence.dispose).toHaveBeenCalledTimes(1);
  });

  it('should support dispose helper function', () => {
    getOrCreateNovelToSTRuntime();

    disposeNovelToSTRuntime();

    expect(runtimeComposablesMock.foundationPersistence.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeComposablesMock.outlinePersistence.dispose).toHaveBeenCalledTimes(1);
  });
});
