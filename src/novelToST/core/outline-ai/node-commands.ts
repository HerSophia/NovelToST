import type { MasterOutlineNode } from '../../types/outline';
import {
  extractGenericCommandItems,
  isRecord,
  normalizeCrudCommandOperation,
  normalizeMasterOutlineNodeFromItem,
  type ExtractedItems,
  type OutlineCrudCommandOp,
} from './shared';

type OutlineNodeCommandOp = OutlineCrudCommandOp;

function extractMasterOutlineItems(payload: unknown): ExtractedItems {
  if (Array.isArray(payload)) {
    return {
      hasField: true,
      items: payload,
    };
  }

  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.masterOutline)) {
    return {
      hasField: true,
      items: payload.masterOutline,
    };
  }

  if (Array.isArray(payload.nodes)) {
    return {
      hasField: true,
      items: payload.nodes,
    };
  }

  if (Array.isArray(payload.outline)) {
    return {
      hasField: true,
      items: payload.outline,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection)) {
    if (Array.isArray(outlineSection.nodes)) {
      return {
        hasField: true,
        items: outlineSection.nodes,
      };
    }

    if (Array.isArray(outlineSection.masterOutline)) {
      return {
        hasField: true,
        items: outlineSection.masterOutline,
      };
    }
  }

  return {
    hasField: false,
    items: [],
  };
}

function extractNodeCommandItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.nodeCommands)) {
    return {
      hasField: true,
      items: payload.nodeCommands,
    };
  }

  if (Array.isArray(payload.nodeOps)) {
    return {
      hasField: true,
      items: payload.nodeOps,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection)) {
    if (Array.isArray(outlineSection.nodeCommands)) {
      return {
        hasField: true,
        items: outlineSection.nodeCommands,
      };
    }

    if (Array.isArray(outlineSection.nodeOps)) {
      return {
        hasField: true,
        items: outlineSection.nodeOps,
      };
    }
  }

  return {
    hasField: false,
    items: [],
  };
}

function normalizeNodeSplitOperationFromType(raw: unknown): 'split' | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'node.split' ||
    normalized === 'node_split' ||
    normalized === 'split_node' ||
    normalized === 'outline.node.split'
  ) {
    return 'split';
  }

  return null;
}

function normalizeNodeCommandOperationFromType(raw: unknown): OutlineNodeCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'node.create' ||
    normalized === 'node_create' ||
    normalized === 'create_node' ||
    normalized === 'outline.node.create'
  ) {
    return 'create';
  }

  if (
    normalized === 'node.update' ||
    normalized === 'node_update' ||
    normalized === 'update_node' ||
    normalized === 'outline.node.update'
  ) {
    return 'update';
  }

  if (
    normalized === 'node.delete' ||
    normalized === 'node_remove' ||
    normalized === 'node_delete' ||
    normalized === 'delete_node' ||
    normalized === 'remove_node' ||
    normalized === 'outline.node.delete' ||
    normalized === 'outline.node.remove'
  ) {
    return 'delete';
  }

  return null;
}

function isNodeCommandTarget(raw: unknown): boolean {
  if (typeof raw !== 'string') {
    return false;
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');

  return (
    normalized === 'node' ||
    normalized === 'nodes' ||
    normalized === 'outline_node' ||
    normalized === 'outline_nodes' ||
    normalized === 'master_outline_node' ||
    normalized === 'master_outline_nodes'
  );
}

function normalizeNodeSplitOperation(raw: unknown): 'split' | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'split' || normalized === 's') {
    return 'split';
  }

  return null;
}

function normalizeNodeCommandOperation(raw: unknown): OutlineNodeCommandOp | null {
  return normalizeCrudCommandOperation(raw);
}

function normalizeNodeCommandFromGenericCommand(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }

  const splitOperationByType = normalizeNodeSplitOperationFromType(item.type ?? item.kind);
  const hasNodeTarget = [item.target, item.entity, item.resource].some(value => isNodeCommandTarget(value));
  const splitOperationByOp = normalizeNodeSplitOperation(item.op ?? item.action);
  const hasSplitShape = Array.isArray(item.segments) || Array.isArray(item.nodes) || Array.isArray(item.children);
  if (splitOperationByType || (splitOperationByOp && (hasNodeTarget || hasSplitShape))) {
    return {
      ...item,
      op: 'split',
      action: 'split',
    };
  }

  const operationByType = normalizeNodeCommandOperationFromType(item.type ?? item.kind);
  const operationByOp = hasNodeTarget ? normalizeNodeCommandOperation(item.op ?? item.action) : null;
  const operation = operationByType ?? operationByOp;
  if (!operation) {
    return null;
  }

  return {
    ...item,
    op: operation,
    action: operation,
  };
}

function resolveNodeCommandId(command: Record<string, unknown>): string {
  const candidates = [command.id, command.nodeId, command.targetId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function omitNodeCommandMeta(command: Record<string, unknown>): Record<string, unknown> {
  const omittedKeys = new Set([
    'op',
    'action',
    'id',
    'nodeId',
    'targetId',
    'patch',
    'node',
    'payload',
    'data',
    'type',
    'kind',
    'target',
    'entity',
    'resource',
  ]);
  const seed: Record<string, unknown> = {};

  Object.entries(command).forEach(([key, value]) => {
    if (omittedKeys.has(key)) {
      return;
    }

    seed[key] = value;
  });

  return seed;
}

function resolveNodeCommandPatch(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.patch)) {
    return command.patch;
  }

  if (isRecord(command.node)) {
    return command.node;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitNodeCommandMeta(command);
  return Object.keys(fallback).length > 0 ? fallback : null;
}

function resolveNodeCommandCreateSeed(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.node)) {
    return command.node;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitNodeCommandMeta(command);
  const commandNodeId = resolveNodeCommandId(command);
  if (commandNodeId) {
    fallback.id = commandNodeId;
  }

  return Object.keys(fallback).length > 0 ? fallback : null;
}

function isNodeSplitCommandItem(command: Record<string, unknown>): boolean {
  if (normalizeNodeSplitOperationFromType(command.type ?? command.kind)) {
    return true;
  }

  const splitByOp = normalizeNodeSplitOperation(command.op ?? command.action);
  if (!splitByOp) {
    return false;
  }

  const hasNodeTarget = [command.target, command.entity, command.resource].some(value => isNodeCommandTarget(value));
  if (hasNodeTarget) {
    return true;
  }

  return (
    Array.isArray(command.segments) ||
    Array.isArray(command.nodes) ||
    Array.isArray(command.children) ||
    typeof command.sourceId === 'string'
  );
}

function resolveNodeSplitSourceId(command: Record<string, unknown>): string {
  const candidates = [command.sourceId, command.id, command.nodeId, command.targetId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function resolveNodeSplitSegments(command: Record<string, unknown>): Record<string, unknown>[] {
  const candidates = [command.segments, command.nodes, command.children];
  const matched = candidates.find(candidate => Array.isArray(candidate));
  if (!Array.isArray(matched)) {
    return [];
  }

  return matched.filter(item => isRecord(item)) as Record<string, unknown>[];
}

function compareMasterOutlineNodeOrder(left: MasterOutlineNode, right: MasterOutlineNode): number {
  if (left.chapterStart !== right.chapterStart) {
    return left.chapterStart - right.chapterStart;
  }

  if (left.chapterEnd !== right.chapterEnd) {
    return left.chapterEnd - right.chapterEnd;
  }

  return left.id.localeCompare(right.id);
}

function ensureUniqueMasterOutlineNodeId(candidate: string, existingIds: Set<string>, fallbackIndex: number): string {
  const baseId = candidate.trim() || `outline-ai-node-${Math.max(1, Math.trunc(fallbackIndex) + 1)}`;
  let nextId = baseId;
  let suffix = 1;
  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
}

function sortMasterOutlineNodes(nodes: MasterOutlineNode[]): MasterOutlineNode[] {
  return [...nodes].sort(compareMasterOutlineNodeOrder);
}

function expandNodeSplitCommands(
  commandItems: unknown[],
  baseMasterOutline: MasterOutlineNode[],
): {
  commandItems: unknown[];
  commandWarnings: string[];
} {
  const expandedItems: unknown[] = [];
  const commandWarnings: string[] = [];
  const sourceNodeById = new Map(baseMasterOutline.map(node => [node.id, node]));

  commandItems.forEach((item, index) => {
    if (!isRecord(item) || !isNodeSplitCommandItem(item)) {
      expandedItems.push(item);
      return;
    }

    const sourceNodeId = resolveNodeSplitSourceId(item);
    if (!sourceNodeId) {
      commandWarnings.push(`node.split 命令#${index + 1} 缺少 sourceId/id，已跳过`);
      return;
    }

    const segments = resolveNodeSplitSegments(item);
    if (segments.length < 2) {
      commandWarnings.push(`node.split 命令#${index + 1} 至少需要 2 个分段节点，已跳过（id=${sourceNodeId}）`);
      return;
    }

    const sourceNode = sourceNodeById.get(sourceNodeId) ?? null;
    const keepSource = typeof item.keepSource === 'boolean' ? item.keepSource : true;
    const normalizeSegmentSeed = (segment: Record<string, unknown>, segmentIndex: number): Record<string, unknown> => {
      const seed: Record<string, unknown> = {
        ...segment,
      };

      if (sourceNode) {
        if (
          (typeof seed.storylineId !== 'string' || !seed.storylineId.trim()) &&
          typeof sourceNode.storylineId === 'string' &&
          sourceNode.storylineId.trim()
        ) {
          seed.storylineId = sourceNode.storylineId;
        }

        if (!('phase' in seed) && sourceNode.phase) {
          seed.phase = sourceNode.phase;
        }

        if (!('status' in seed) && sourceNode.status) {
          seed.status = sourceNode.status;
        }
      }

      const hasId = typeof seed.id === 'string' && seed.id.trim().length > 0;
      if (!hasId) {
        seed.id = `${sourceNodeId}-split-${segmentIndex + 1}`;
      }

      return seed;
    };

    if (keepSource) {
      const firstSeed = normalizeSegmentSeed(segments[0], 0);
      const updatePatch: Record<string, unknown> = { ...firstSeed };
      delete updatePatch.id;

      expandedItems.push({
        op: 'update',
        action: 'update',
        id: sourceNodeId,
        patch: updatePatch,
      });

      segments.slice(1).forEach((segment, segmentIndex) => {
        expandedItems.push({
          op: 'create',
          action: 'create',
          node: normalizeSegmentSeed(segment, segmentIndex + 1),
        });
      });

      return;
    }

    expandedItems.push({
      op: 'delete',
      action: 'delete',
      id: sourceNodeId,
    });

    segments.forEach((segment, segmentIndex) => {
      expandedItems.push({
        op: 'create',
        action: 'create',
        node: normalizeSegmentSeed(segment, segmentIndex),
      });
    });
  });

  return {
    commandItems: expandedItems,
    commandWarnings,
  };
}

function applyNodeCommandsToMasterOutline(
  baseMasterOutline: MasterOutlineNode[],
  commandItems: unknown[],
  chapterCount: number,
): {
  masterOutline: MasterOutlineNode[];
  appliedCommandCount: number;
  commandWarnings: string[];
} {
  let nextNodes = [...baseMasterOutline];
  let appliedCommandCount = 0;
  const commandWarnings: string[] = [];
  const nextNodeIds = new Set(nextNodes.map(node => node.id));
  const lastOperationByNodeId = new Map<string, OutlineNodeCommandOp>();

  commandItems.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const operation = normalizeNodeCommandOperation(item.op ?? item.action);
    if (!operation) {
      return;
    }

    if (operation === 'delete') {
      const commandNodeId = resolveNodeCommandId(item);
      if (!commandNodeId) {
        commandWarnings.push(`node.delete 命令#${index + 1} 缺少 id，已跳过`);
        return;
      }

      if (!nextNodeIds.has(commandNodeId)) {
        const lastOperation = lastOperationByNodeId.get(commandNodeId);
        if (lastOperation === 'delete') {
          commandWarnings.push(`node 命令冲突：id=${commandNodeId} 在删除后再次删除（命令#${index + 1}）`);
        } else {
          commandWarnings.push(`node.delete 命令#${index + 1} 目标不存在（id=${commandNodeId}），已跳过`);
        }
        return;
      }

      const previousOperation = lastOperationByNodeId.get(commandNodeId);
      if (previousOperation === 'update') {
        commandWarnings.push(`node 命令冲突：id=${commandNodeId} 先更新后删除（命令#${index + 1}）`);
      }

      if (previousOperation === 'create') {
        commandWarnings.push(`node 命令冲突：id=${commandNodeId} 同轮先创建后删除（命令#${index + 1}）`);
      }

      nextNodes = nextNodes.filter(node => node.id !== commandNodeId);
      nextNodeIds.delete(commandNodeId);
      lastOperationByNodeId.set(commandNodeId, 'delete');
      appliedCommandCount += 1;
      return;
    }

    if (operation === 'update') {
      const commandNodeId = resolveNodeCommandId(item);
      if (!commandNodeId) {
        commandWarnings.push(`node.update 命令#${index + 1} 缺少 id，已跳过`);
        return;
      }

      const targetNodeIndex = nextNodes.findIndex(node => node.id === commandNodeId);
      if (targetNodeIndex < 0) {
        const lastOperation = lastOperationByNodeId.get(commandNodeId);
        if (lastOperation === 'delete') {
          commandWarnings.push(`node 命令冲突：id=${commandNodeId} 先删除后更新（命令#${index + 1}）`);
        } else {
          commandWarnings.push(`node.update 命令#${index + 1} 目标不存在（id=${commandNodeId}），已跳过`);
        }
        return;
      }

      const patch = resolveNodeCommandPatch(item);
      if (!patch) {
        commandWarnings.push(`node.update 命令#${index + 1} 缺少 patch，已跳过（id=${commandNodeId}）`);
        return;
      }

      if (typeof patch.id === 'string' && patch.id.trim() && patch.id.trim() !== commandNodeId) {
        commandWarnings.push(`node.update 命令#${index + 1} 试图改写 id，已忽略（id=${commandNodeId}）`);
      }

      const normalizedNode = normalizeMasterOutlineNodeFromItem(
        {
          ...nextNodes[targetNodeIndex],
          ...patch,
          id: commandNodeId,
        },
        nextNodes.length + index,
        chapterCount,
      );

      if (!normalizedNode) {
        return;
      }

      nextNodes[targetNodeIndex] = {
        ...normalizedNode,
        id: commandNodeId,
      };
      appliedCommandCount += 1;
      lastOperationByNodeId.set(commandNodeId, 'update');
      return;
    }

    const createSeed = resolveNodeCommandCreateSeed(item);
    if (!createSeed) {
      commandWarnings.push(`node.create 命令#${index + 1} 缺少创建数据，已跳过`);
      return;
    }

    const requestedNodeId = typeof createSeed.id === 'string' ? createSeed.id.trim() : '';
    if (requestedNodeId && nextNodeIds.has(requestedNodeId)) {
      commandWarnings.push(`node.create 命令#${index + 1} 的 id=${requestedNodeId} 已存在，系统将自动重命名`);
    }

    const normalizedNode = normalizeMasterOutlineNodeFromItem(createSeed, nextNodes.length + index, chapterCount);
    if (!normalizedNode) {
      commandWarnings.push(`node.create 命令#${index + 1} 创建数据无效，已跳过`);
      return;
    }

    const nextNodeId = ensureUniqueMasterOutlineNodeId(normalizedNode.id, nextNodeIds, nextNodes.length + index);
    const createdNode = {
      ...normalizedNode,
      id: nextNodeId,
    };

    nextNodes.push(createdNode);
    nextNodeIds.add(nextNodeId);
    lastOperationByNodeId.set(nextNodeId, 'create');
    appliedCommandCount += 1;
  });

  return {
    masterOutline: sortMasterOutlineNodes(nextNodes),
    appliedCommandCount,
    commandWarnings,
  };
}

export function normalizeMasterOutlineFromPayload(
  payload: unknown,
  chapterCount: number,
): {
  hasField: boolean;
  masterOutline: MasterOutlineNode[];
} {
  const extracted = extractMasterOutlineItems(payload);
  if (!extracted.hasField) {
    return {
      hasField: false,
      masterOutline: [],
    };
  }

  const masterOutline = extracted.items
    .map((item, index) => normalizeMasterOutlineNodeFromItem(item, index, chapterCount))
    .filter((node): node is MasterOutlineNode => node !== null);

  return {
    hasField: true,
    masterOutline: sortMasterOutlineNodes(masterOutline),
  };
}

export function normalizeMasterOutlineCommandsFromPayload(
  payload: unknown,
  options: {
    chapterCount: number;
    baseMasterOutline: MasterOutlineNode[];
  },
): {
  hasField: boolean;
  masterOutline: MasterOutlineNode[];
  commandWarnings: string[];
} {
  const extractedNodeCommands = extractNodeCommandItems(payload);
  const extractedCommands = extractGenericCommandItems(payload);

  if (!extractedNodeCommands.hasField && !extractedCommands.hasField) {
    return {
      hasField: false,
      masterOutline: [],
      commandWarnings: [],
    };
  }

  const normalizedGenericNodeCommands = extractedCommands.items
    .map(item => normalizeNodeCommandFromGenericCommand(item))
    .filter((item): item is Record<string, unknown> => item !== null);
  const mergedCommandItems = [...extractedNodeCommands.items, ...normalizedGenericNodeCommands];
  if (mergedCommandItems.length === 0) {
    return {
      hasField: false,
      masterOutline: [],
      commandWarnings: [],
    };
  }

  const expanded = expandNodeSplitCommands(mergedCommandItems, options.baseMasterOutline);
  if (expanded.commandItems.length === 0) {
    return {
      hasField: false,
      masterOutline: [],
      commandWarnings: expanded.commandWarnings,
    };
  }

  const applied = applyNodeCommandsToMasterOutline(options.baseMasterOutline, expanded.commandItems, options.chapterCount);
  const commandWarnings = [...expanded.commandWarnings, ...applied.commandWarnings];
  if (applied.appliedCommandCount <= 0) {
    return {
      hasField: false,
      masterOutline: [],
      commandWarnings,
    };
  }

  return {
    hasField: true,
    masterOutline: applied.masterOutline,
    commandWarnings,
  };
}
