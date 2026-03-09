import { resolveBodyFromCandidates } from '@/novelToST/app/mount-target.resolver';

describe('resolveBodyFromCandidates', () => {
  it('should return the first connected body candidate', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = document.body;
    const second = document.createElement('body');

    const resolved = resolveBodyFromCandidates([
      () => first,
      () => second,
    ]);

    expect(resolved).toBe(first);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should skip invalid candidates and warn when falling back', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const connectedFallback = document.body;

    const resolved = resolveBodyFromCandidates([
      () => {
        throw new Error('cross-origin blocked');
      },
      () => document.createElement('body'),
      () => connectedFallback,
    ]);

    expect(resolved).toBe(connectedFallback);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw when no connected body candidate exists', () => {
    expect(() => {
      resolveBodyFromCandidates([
        () => null,
        () => document.createElement('body'),
      ]);
    }).toThrow('[novelToST] 无法定位 Tavern 根 body');
  });
});
