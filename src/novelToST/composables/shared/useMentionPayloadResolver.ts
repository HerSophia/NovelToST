import {
  resolveOutlineMentionSnapshots,
  type OutlineMentionContext,
} from '../../core/outline-mention.service';
import type { OutlineMentionRef, OutlineMentionSnapshot } from '../../types/outline';

export type MentionPayloadResolverInput = {
  mentions?: OutlineMentionRef[];
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
  context: OutlineMentionContext;
  frozenAt?: string;
};

export type ResolvedMentionPayload = {
  mentions?: OutlineMentionRef[];
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
};

export function normalizeMentionRefs(mentions: OutlineMentionRef[] | undefined): OutlineMentionRef[] {
  if (!Array.isArray(mentions) || mentions.length === 0) {
    return [];
  }

  const deduped = new Map<string, OutlineMentionRef>();
  mentions.forEach(mention => {
    const id = mention.id.trim();
    if (!id) {
      return;
    }

    deduped.set(`${mention.kind}:${id}`, {
      kind: mention.kind,
      id,
      label: mention.label.trim() || id,
    });
  });

  return [...deduped.values()];
}

export function normalizeMentionSnapshots(snapshots: OutlineMentionSnapshot[] | undefined): OutlineMentionSnapshot[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return [];
  }

  const deduped = new Map<string, OutlineMentionSnapshot>();
  snapshots.forEach(snapshot => {
    const id = snapshot.id.trim();
    if (!id || snapshot.content.trim().length === 0) {
      return;
    }

    deduped.set(`${snapshot.kind}:${id}`, {
      kind: snapshot.kind,
      id,
      label: snapshot.label.trim() || id,
      frozenAt: snapshot.frozenAt,
      content: snapshot.content,
    });
  });

  return [...deduped.values()];
}

export function normalizeMentionWarnings(warnings: string[] | undefined): string[] {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return [];
  }

  const deduped = new Set<string>();
  warnings.forEach(warning => {
    const normalized = warning.trim();
    if (!normalized) {
      return;
    }

    deduped.add(normalized);
  });

  return [...deduped.values()];
}

export async function resolveMentionPayloadForSend(
  input: MentionPayloadResolverInput,
): Promise<ResolvedMentionPayload> {
  const mentions = normalizeMentionRefs(input.mentions);
  const hasProvidedSnapshots = input.mentionSnapshots !== undefined;
  const baseWarnings = normalizeMentionWarnings(input.mentionWarnings);

  if (hasProvidedSnapshots) {
    return {
      mentions: mentions.length > 0 ? mentions : undefined,
      mentionSnapshots: normalizeMentionSnapshots(input.mentionSnapshots),
      mentionWarnings: baseWarnings.length > 0 ? baseWarnings : undefined,
    };
  }

  if (mentions.length === 0) {
    return {
      mentions: undefined,
      mentionSnapshots: undefined,
      mentionWarnings: baseWarnings.length > 0 ? baseWarnings : undefined,
    };
  }

  const resolved = await resolveOutlineMentionSnapshots({
    mentions,
    context: input.context,
    frozenAt: input.frozenAt,
  });

  const mergedWarnings = normalizeMentionWarnings([...baseWarnings, ...resolved.warnings]);

  return {
    mentions,
    mentionSnapshots: normalizeMentionSnapshots(resolved.snapshots),
    mentionWarnings: mergedWarnings.length > 0 ? mergedWarnings : undefined,
  };
}
