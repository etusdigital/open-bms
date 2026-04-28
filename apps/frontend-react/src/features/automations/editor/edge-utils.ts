import type { AutomationNode, AutomationEdge } from './types';
import { NODE_WIDTH, SUB_NODE_TYPES } from './types';

/** Approximate node height (matches the min-w-[220px] + padding in node components) */
const NODE_HEIGHT = 60;

/**
 * Get the center position of a node (position is top-left in React Flow).
 */
function _nodeCenter(node: AutomationNode): { x: number; y: number } {
  const w = node.measured?.width ?? NODE_WIDTH;
  const h = node.measured?.height ?? NODE_HEIGHT;
  return {
    x: node.position.x + w / 2,
    y: node.position.y + h / 2,
  };
}

/**
 * Get the source handle position (bottom-center of the node).
 */
function sourceHandlePos(node: AutomationNode): { x: number; y: number } {
  const w = node.measured?.width ?? NODE_WIDTH;
  const h = node.measured?.height ?? NODE_HEIGHT;
  return {
    x: node.position.x + w / 2,
    y: node.position.y + h,
  };
}

/**
 * Get the target handle position (top-center of the node).
 */
function targetHandlePos(node: AutomationNode): { x: number; y: number } {
  const w = node.measured?.width ?? NODE_WIDTH;
  return {
    x: node.position.x + w / 2,
    y: node.position.y,
  };
}

/**
 * Check if a point is inside a node's bounding box (with optional padding).
 */
function isInsideNode(point: { x: number; y: number }, node: AutomationNode, padding = 10): boolean {
  const w = node.measured?.width ?? NODE_WIDTH;
  const h = node.measured?.height ?? NODE_HEIGHT;
  return (
    point.x >= node.position.x - padding &&
    point.x <= node.position.x + w + padding &&
    point.y >= node.position.y - padding &&
    point.y <= node.position.y + h + padding
  );
}

/**
 * Find the nearest edge to a drop position within a threshold distance.
 * Uses the actual handle positions (source bottom-center → target top-center)
 * for accurate detection. Ignores detection when the cursor is over an existing node.
 */
export function findNearestEdge(
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  dropPosition: { x: number; y: number },
  threshold: number,
): AutomationEdge | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // If the cursor is hovering over any existing node, don't detect edges
  for (const node of nodes) {
    if (isInsideNode(dropPosition, node)) {
      return null;
    }
  }

  let nearest: AutomationEdge | null = null;
  let nearestDist = threshold;

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    // Skip structural edges (conditional→yes/no, split→splitPath)
    if (SUB_NODE_TYPES.has(targetNode.type ?? '')) continue;

    // Use handle positions: source bottom-center → target top-center
    const sourcePos = sourceHandlePos(sourceNode);
    const targetPos = targetHandlePos(targetNode);

    const dist = distanceToSegment(dropPosition, sourcePos, targetPos);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = edge;
    }
  }

  return nearest;
}

/**
 * Distance from a point to a line segment (segStart → segEnd).
 * Projects the point onto the segment and clamps to [0, 1].
 */
export function distanceToSegment(
  point: { x: number; y: number },
  segStart: { x: number; y: number },
  segEnd: { x: number; y: number },
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const px = point.x - segStart.x;
    const py = point.y - segStart.y;
    return Math.sqrt(px * px + py * py);
  }

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;
  const px = point.x - projX;
  const py = point.y - projY;

  return Math.sqrt(px * px + py * py);
}

/**
 * Apply single-output constraint: remove any existing outgoing edge from
 * a source node before adding a new one.
 */
export function replaceOutgoingEdge(
  edges: AutomationEdge[],
  sourceId: string,
  newEdge: AutomationEdge,
): AutomationEdge[] {
  return [...edges.filter((e) => e.source !== sourceId), newEdge];
}

/**
 * Splice a new node into an existing edge: remove the old edge and create
 * two new edges (source → newNode, newNode → target).
 */
export function spliceNodeIntoEdge(
  edges: AutomationEdge[],
  edgeToSplice: AutomationEdge,
  newNodeId: string,
): AutomationEdge[] {
  return [
    ...edges.filter((e) => e.id !== edgeToSplice.id),
    {
      id: `e${edgeToSplice.source}-${newNodeId}`,
      source: edgeToSplice.source,
      target: newNodeId,
      type: 'smoothstep' as const,
    },
    {
      id: `e${newNodeId}-${edgeToSplice.target}`,
      source: newNodeId,
      target: edgeToSplice.target,
      type: 'smoothstep' as const,
    },
  ];
}
