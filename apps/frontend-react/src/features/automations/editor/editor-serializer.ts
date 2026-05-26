import type {
  ApiStep,
  AutomationEdge,
  AutomationNode,
  AnyNodeData,
  UnsupportedNodeData,
  DeserializeResult,
  SerializeResult,
  FlowLayout,
} from './types';
import { KNOWN_STEP_TYPES, BRANCHING_STEP_TYPES, NODE_SPACING } from './types';

// ---------------------------------------------------------------------------
// Deserialize: API recursive tree → React Flow nodes + edges
// ---------------------------------------------------------------------------

export function deserializeStepsToFlow(rootStep: ApiStep): DeserializeResult {
  const nodes: AutomationNode[] = [];
  const edges: AutomationEdge[] = [];
  let maxStepId = 0;

  function walk(step: ApiStep, index: number, parentId?: string, sourceHandle?: string) {
    const nodeId = String(step.id);

    // Track max numeric step ID (string IDs like "path_42_0" are skipped)
    const numericId = typeof step.id === 'number' ? step.id : parseInt(String(step.id), 10);
    if (!isNaN(numericId) && numericId > maxStepId) {
      maxStepId = numericId;
    }

    const isKnown = KNOWN_STEP_TYPES.has(step.type);

    const data: AnyNodeData = isKnown
      ? { stepId: step.id, settings: step.settings as Record<string, never> }
      : {
          stepId: step.id,
          originalType: step.type,
          settings: step.settings as Record<string, unknown>,
        };

    nodes.push({
      id: nodeId,
      type: isKnown ? step.type : 'unsupported',
      position: { x: 0, y: index * NODE_SPACING },
      data,
    });

    if (parentId) {
      edges.push({
        id: `e${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep',
        ...(sourceHandle && { sourceHandle }),
      });
    }

    if (step.child && step.child.length > 0) {
      const isBranching = BRANCHING_STEP_TYPES.has(step.type);

      for (let i = 0; i < step.child.length; i++) {
        const child = step.child[i];
        let handle: string | undefined;

        if (isBranching && step.type === 'split') {
          // Split: handle per path key
          const pathSettings = child.settings as { path?: string };
          handle = `path-${pathSettings?.path ?? String(i + 1)}`;
        } else if (isBranching && step.type === 'conditional') {
          // Conditional: "yes" for first child (conditionalTrue), "no" for second (conditionalFalse)
          handle = i === 0 ? 'yes' : 'no';
        }

        walk(child, nodes.length, nodeId, handle);
      }
    }
  }

  walk(rootStep, 0);

  return { nodes, edges, maxStepId };
}

// ---------------------------------------------------------------------------
// Serialize: React Flow nodes + edges → API recursive tree
// ---------------------------------------------------------------------------

export function serializeFlowToSteps(nodes: AutomationNode[], edges: AutomationEdge[]): SerializeResult {
  if (nodes.length === 0) {
    return { success: false, error: 'No nodes in the flow' };
  }

  // Build adjacency: source → { target, sourceHandle }[]
  const childrenOf = new Map<string, Array<{ target: string; sourceHandle?: string }>>();
  const hasIncoming = new Set<string>();

  for (const edge of edges) {
    const children = childrenOf.get(edge.source) ?? [];
    children.push({ target: edge.target, sourceHandle: edge.sourceHandle ?? undefined });
    childrenOf.set(edge.source, children);
    hasIncoming.add(edge.target);
  }

  // Find root: node with no incoming edges (should be the trigger)
  const rootNode = nodes.find((n) => !hasIncoming.has(n.id));
  if (!rootNode) {
    return {
      success: false,
      error: 'No root node found (all nodes have incoming edges — possible cycle)',
    };
  }

  // Detect cycles via visited set
  const visited = new Set<string>();

  function buildTree(nodeId: string): ApiStep | null {
    if (visited.has(nodeId)) return null; // cycle guard
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const data = node.data as AnyNodeData;
    const childEntries = childrenOf.get(nodeId) ?? [];

    // Sort children: by sourceHandle (for branching nodes) or Y position (for linear)
    const sortedEntries = [...childEntries].sort((a, b) => {
      // If sourceHandle exists, sort by handle name (yes before no; path-N numerically)
      if (a.sourceHandle && b.sourceHandle) {
        return compareSourceHandles(a, b);
      }
      // Fallback: sort by Y position
      const nodeA = nodes.find((n) => n.id === a.target);
      const nodeB = nodes.find((n) => n.id === b.target);
      return (nodeA?.position.y ?? 0) - (nodeB?.position.y ?? 0);
    });

    const children: ApiStep[] = [];
    for (const entry of sortedEntries) {
      const child = buildTree(entry.target);
      if (child) children.push(child);
    }

    // Reconstruct the step type
    const isUnsupported = 'originalType' in data;
    const stepType = isUnsupported ? (data as UnsupportedNodeData).originalType : (node.type ?? 'end');

    // Backend schema requires conditionalTrue.settings to mirror its parent conditional's
    // rules (obj_conditional with minItems:1). The editor only stores rules on the conditional
    // node; we re-impose the legacy invariant here at the wire-format boundary.
    let settings = data.settings;
    if (stepType === 'conditionalTrue') {
      const parentEdge = edges.find((e) => e.target === nodeId && e.sourceHandle === 'yes');
      if (parentEdge) {
        const parentNode = nodes.find((n) => n.id === parentEdge.source);
        const parentSettings = (parentNode?.data as AnyNodeData | undefined)?.settings;
        if (parentSettings !== undefined) {
          settings = parentSettings;
        }
      }
    }

    return {
      id: data.stepId,
      type: stepType,
      settings,
      child: children,
    } as ApiStep;
  }

  const root = buildTree(rootNode.id);
  if (!root) {
    return { success: false, error: 'Failed to build tree from root node' };
  }

  return { success: true, root };
}

// ---------------------------------------------------------------------------
// Layout: assign positions for linear flows (Phase 1)
// ---------------------------------------------------------------------------

export function layoutLinearFlow(nodes: AutomationNode[], edges: AutomationEdge[]): AutomationNode[] {
  if (nodes.length === 0) return nodes;

  // Build ordered list by walking from root through edges
  const childMap = new Map<string, string>();
  const hasIncoming = new Set<string>();

  for (const edge of edges) {
    childMap.set(edge.source, edge.target);
    hasIncoming.add(edge.target);
  }

  const rootNode = nodes.find((n) => !hasIncoming.has(n.id));
  if (!rootNode) return nodes;

  const ordered: string[] = [];
  let current: string | undefined = rootNode.id;

  while (current) {
    ordered.push(current);
    current = childMap.get(current);
  }

  // Position nodes in order
  return nodes.map((node) => {
    const index = ordered.indexOf(node.id);
    if (index === -1) return node;
    return {
      ...node,
      position: { x: 0, y: index * NODE_SPACING },
    };
  });
}

// ---------------------------------------------------------------------------
// Deserialize with persisted layout: merge saved positions into tree nodes
// ---------------------------------------------------------------------------

export function deserializeWithLayout(rootStep: ApiStep, flowLayout: FlowLayout | null | undefined): DeserializeResult {
  const result = deserializeStepsToFlow(rootStep);

  if (!flowLayout) return result;

  // Merge persisted positions into deserialized nodes
  const positionMap = new Map(flowLayout.nodes.map((n) => [n.id, n.position]));

  const restoredNodes = result.nodes.map((node) => {
    const pos = positionMap.get(node.id);
    return pos ? { ...node, position: pos } : node;
  });

  // Use persisted edges if available (may include user-created connections)
  const restoredEdges =
    flowLayout.edges.length > 0
      ? flowLayout.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: 'smoothstep' as const,
        }))
      : result.edges;

  return { nodes: restoredNodes, edges: restoredEdges, maxStepId: result.maxStepId };
}

// ---------------------------------------------------------------------------
// Build FlowLayout from current editor state
// ---------------------------------------------------------------------------

export function buildFlowLayout(
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  viewport?: { x: number; y: number; zoom: number },
): FlowLayout {
  return {
    nodes: nodes.map((n) => ({ id: n.id, position: n.position })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
    viewport,
  };
}

function compareSourceHandles(a: { sourceHandle?: string }, b: { sourceHandle?: string }): number {
  const ah = a.sourceHandle ?? '';
  const bh = b.sourceHandle ?? '';
  if (ah === bh) return 0;
  // Conditional: yes before no
  if (ah === 'yes' && bh === 'no') return -1;
  if (ah === 'no' && bh === 'yes') return 1;
  // Split: 'path-N' compared numerically so path-10 sorts after path-2
  const am = ah.match(/^path-(\d+)$/);
  const bm = bh.match(/^path-(\d+)$/);
  if (am && bm) return Number(am[1]) - Number(bm[1]);
  return ah.localeCompare(bh);
}
