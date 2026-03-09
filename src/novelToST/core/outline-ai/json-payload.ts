import { isRecord } from './shared';

function pushUniqueJsonCandidate(candidates: string[], candidate: string): void {
  const normalized = candidate.trim().replace(/^\uFEFF/, '');
  if (!normalized) {
    return;
  }

  if (candidates.includes(normalized)) {
    return;
  }

  candidates.push(normalized);
}

function extractBalancedJsonSegments(text: string, openChar: '{' | '[', closeChar: '}' | ']'): string[] {
  const segments: string[] = [];

  let depth = 0;
  let segmentStart = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      if (depth === 0) {
        segmentStart = index;
      }
      depth += 1;
      continue;
    }

    if (char === closeChar && depth > 0) {
      depth -= 1;
      if (depth === 0 && segmentStart >= 0) {
        segments.push(text.slice(segmentStart, index + 1));
        segmentStart = -1;
      }
    }
  }

  return segments;
}

function escapeUnescapedControlCharsInJsonStrings(text: string): string {
  let normalized = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        normalized += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        normalized += char;
        escaped = true;
        continue;
      }

      if (char === '"') {
        normalized += char;
        inString = false;
        continue;
      }

      if (char === '\n') {
        normalized += '\\n';
        continue;
      }

      if (char === '\r') {
        normalized += '\\r';
        continue;
      }

      if (char === '\t') {
        normalized += '\\t';
        continue;
      }

      normalized += char;
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    normalized += char;
  }

  return normalized;
}

function tryParseJsonCandidate(candidate: string, depth: number = 0): unknown | null {
  const parse = (source: string): unknown | null => {
    try {
      return JSON.parse(source) as unknown;
    } catch {
      return null;
    }
  };

  const direct = parse(candidate);
  const repaired =
    direct === null
      ? parse(escapeUnescapedControlCharsInJsonStrings(candidate).replace(/,\s*([}\]])/g, '$1'))
      : direct;

  if (repaired === null) {
    return null;
  }

  if (isRecord(repaired) || Array.isArray(repaired)) {
    return repaired;
  }

  if (typeof repaired === 'string' && depth < 2) {
    const nested = repaired.trim();
    const looksLikeJson =
      (nested.startsWith('{') && nested.endsWith('}')) ||
      (nested.startsWith('[') && nested.endsWith(']'));
    if (looksLikeJson) {
      return tryParseJsonCandidate(nested, depth + 1);
    }
  }

  return null;
}

function scoreOutlinePayloadCandidate(payload: unknown): number {
  if (isRecord(payload)) {
    const keyWeights: Record<string, number> = {
      foundation: 6,
      foundationPatch: 6,
      setup: 4,
      storylines: 5,
      nodes: 6,
      masterOutline: 6,
      details: 5,
      chapterDetails: 5,
      detailsByChapter: 5,
      detail: 4,
      commands: 7,
      foundationCommands: 7,
      setupCommands: 6,
      nodeCommands: 6,
      storylineCommands: 6,
      detailCommands: 6,
      foundationOps: 6,
      setupOps: 5,
      nodeOps: 5,
      storylineOps: 5,
      detailOps: 5,
    };

    let score = 0;
    for (const [key, weight] of Object.entries(keyWeights)) {
      if (key in payload) {
        score += weight;
      }
    }

    const outlineSection = payload.outline;
    if (isRecord(outlineSection)) {
      score += Math.max(1, Math.trunc(scoreOutlinePayloadCandidate(outlineSection) * 0.8));
    }

    return score;
  }

  if (Array.isArray(payload)) {
    const recordItems = payload.filter(item => isRecord(item)) as Record<string, unknown>[];
    if (recordItems.length === 0) {
      return -2;
    }

    const commandLikeCount = recordItems.filter(item => ['type', 'op', 'action', 'kind'].some(key => key in item)).length;
    const nodeLikeCount = recordItems.filter(item => ['title', 'summary', 'chapterStart', 'chapterEnd'].some(key => key in item)).length;
    const detailLikeCount = recordItems.filter(item => ['chapter', 'goal', 'conflict', 'beats'].some(key => key in item)).length;

    let score = 0;
    if (commandLikeCount > 0) {
      score += 1;
    }
    if (nodeLikeCount > 0) {
      score += 4;
    }
    if (detailLikeCount > 0) {
      score += 4;
    }

    if (score === 0) {
      return -1;
    }

    return score;
  }

  return -2;
}

export function extractJsonPayload(responseText: string): unknown | null {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  const candidates: string[] = [];
  pushUniqueJsonCandidate(candidates, trimmed);

  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    if (match[1]) {
      pushUniqueJsonCandidate(candidates, match[1]);
    }
  }

  extractBalancedJsonSegments(trimmed, '{', '}').forEach(candidate => pushUniqueJsonCandidate(candidates, candidate));
  extractBalancedJsonSegments(trimmed, '[', ']').forEach(candidate => pushUniqueJsonCandidate(candidates, candidate));

  let bestParsed: unknown | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed === null) {
      continue;
    }

    const score = scoreOutlinePayloadCandidate(parsed);
    if (score > bestScore) {
      bestScore = score;
      bestParsed = parsed;
    }
  }

  return bestParsed;
}
