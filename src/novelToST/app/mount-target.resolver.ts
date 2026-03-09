type BodyResolver = () => HTMLElement | null | undefined;

const RESOLVER_WARN_PREFIX = '[novelToST][mount-target]';

function tryResolveBody(resolver: BodyResolver): HTMLElement | null {
  try {
    return resolver() ?? null;
  } catch {
    return null;
  }
}

export function resolveBodyFromCandidates(candidates: BodyResolver[]): HTMLElement {
  for (const [index, resolver] of candidates.entries()) {
    const body = tryResolveBody(resolver);
    if (!body || !body.isConnected) {
      continue;
    }

    if (index > 0) {
      console.warn(`${RESOLVER_WARN_PREFIX} 未命中首选挂载目标，已回退到候选 #${index + 1}`);
    }

    return body;
  }

  throw new Error('[novelToST] 无法定位 Tavern 根 body');
}

export function resolveTavernRootBody(): HTMLElement {
  return resolveBodyFromCandidates([
    () => window.parent?.document?.body ?? null,
    () => window.top?.document?.body ?? null,
    () => document.body ?? null,
  ]);
}
