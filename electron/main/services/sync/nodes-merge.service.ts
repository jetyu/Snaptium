type SyncNodeRecord = Record<string, unknown> & {
  id: string;
  order?: number;
  createdAt?: number;
  updatedAt?: number;
};

function parseNodes(text: string): Map<string, SyncNodeRecord> {
  const nodes = new Map<string, SyncNodeRecord>();

  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as Partial<SyncNodeRecord>;
      if (parsed?.id) {
        nodes.set(parsed.id, parsed as SyncNodeRecord);
      }
    } catch {
      continue;
    }
  }

  return nodes;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getUpdatedAt(node: SyncNodeRecord | null): number {
  return Number(node?.updatedAt ?? node?.createdAt ?? 0);
}

function mergePresentNodes(
  localNode: SyncNodeRecord | null,
  remoteNode: SyncNodeRecord | null,
  baseNode: SyncNodeRecord | null,
): SyncNodeRecord {
  const merged: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(baseNode ?? {}),
    ...Object.keys(localNode ?? {}),
    ...Object.keys(remoteNode ?? {}),
  ]);
  const preferLocal = getUpdatedAt(localNode) >= getUpdatedAt(remoteNode);

  for (const key of keys) {
    const baseValue = baseNode?.[key];
    const localValue = localNode?.[key];
    const remoteValue = remoteNode?.[key];
    const localChanged = !deepEqual(localValue, baseValue);
    const remoteChanged = !deepEqual(remoteValue, baseValue);

    if (localChanged && !remoteChanged) {
      if (localValue !== undefined) {
        merged[key] = localValue;
      }
      continue;
    }

    if (!localChanged && remoteChanged) {
      if (remoteValue !== undefined) {
        merged[key] = remoteValue;
      }
      continue;
    }

    if (localChanged && remoteChanged) {
      const winner = preferLocal ? localValue : remoteValue;
      if (winner !== undefined) {
        merged[key] = winner;
      }
      continue;
    }

    const stableValue = localValue !== undefined ? localValue : remoteValue;
    if (stableValue !== undefined) {
      merged[key] = stableValue;
    }
  }

  return merged as SyncNodeRecord;
}

function resolveNode(
  localNode: SyncNodeRecord | null,
  remoteNode: SyncNodeRecord | null,
  baseNode: SyncNodeRecord | null,
): SyncNodeRecord | null {
  if (!baseNode) {
    if (!localNode) {
      return remoteNode ?? null;
    }

    if (!remoteNode) {
      return localNode ?? null;
    }

    return mergePresentNodes(localNode, remoteNode, null);
  }

  const localChanged = !deepEqual(localNode, baseNode);
  const remoteChanged = !deepEqual(remoteNode, baseNode);

  if (!localChanged && !remoteChanged) {
    return baseNode;
  }

  if (localChanged && !remoteChanged) {
    return localNode ?? null;
  }

  if (!localChanged && remoteChanged) {
    return remoteNode ?? null;
  }

  if (!localNode && !remoteNode) {
    return null;
  }

  if (!localNode) {
    return remoteNode ?? null;
  }

  if (!remoteNode) {
    return localNode ?? null;
  }

  return mergePresentNodes(localNode, remoteNode, baseNode);
}

function sortNodes(nodes: SyncNodeRecord[]): SyncNodeRecord[] {
  return [...nodes].sort((left, right) => {
    const leftOrder = Number(left.order ?? left.createdAt ?? 0);
    const rightOrder = Number(right.order ?? right.createdAt ?? 0);

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftCreatedAt = Number(left.createdAt ?? 0);
    const rightCreatedAt = Number(right.createdAt ?? 0);

    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

export function mergeNodesJsonl({
  baseText = '',
  localText = '',
  remoteText = '',
}: {
  baseText?: string;
  localText?: string;
  remoteText?: string;
}): string {
  const baseNodes = parseNodes(baseText);
  const localNodes = parseNodes(localText);
  const remoteNodes = parseNodes(remoteText);
  const mergedNodes: SyncNodeRecord[] = [];
  const ids = new Set([...baseNodes.keys(), ...localNodes.keys(), ...remoteNodes.keys()]);

  for (const id of ids) {
    const mergedNode = resolveNode(localNodes.get(id) ?? null, remoteNodes.get(id) ?? null, baseNodes.get(id) ?? null);
    if (mergedNode) {
      mergedNodes.push(mergedNode);
    }
  }

  const serialized = sortNodes(mergedNodes).map((node) => JSON.stringify(node));
  return serialized.length > 0 ? `${serialized.join('\n')}\n` : '';
}
