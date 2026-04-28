import { describe, it, expect } from 'vitest';
import { findNearestEdge, distanceToSegment, replaceOutgoingEdge, spliceNodeIntoEdge } from '../editor/edge-utils';
import type { AutomationNode, AutomationEdge } from '../editor/types';

// ---------------------------------------------------------------------------
// Fixtures — nodes with positions (top-left) and known dimensions
// Nodes are 220px wide, ~60px tall (matching min-w-[220px] + padding)
// Handles: source at bottom-center, target at top-center
// ---------------------------------------------------------------------------

const NODES: AutomationNode[] = [
  { id: '1', type: 'trigger', position: { x: 100, y: 0 }, data: { stepId: 1, settings: {} } },
  { id: '2', type: 'wait', position: { x: 100, y: 200 }, data: { stepId: 2, settings: {} } },
  { id: '3', type: 'email', position: { x: 100, y: 400 }, data: { stepId: 3, settings: {} } },
  { id: '4', type: 'end', position: { x: 100, y: 600 }, data: { stepId: 4, settings: {} } },
];

// Node 1: top-left (100, 0), bottom-center handle at ~(220, 60)
// Node 2: top-left (100, 200), top-center handle at ~(220, 200), bottom-center at ~(220, 260)
// Edge e1-2 runs from (220, 60) to (220, 200) — vertical line at x=220

const EDGES: AutomationEdge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' },
  { id: 'e2-3', source: '2', target: '3', type: 'smoothstep' },
  { id: 'e3-4', source: '3', target: '4', type: 'smoothstep' },
];

// ---------------------------------------------------------------------------
// distanceToSegment
// ---------------------------------------------------------------------------

describe('distanceToSegment', () => {
  it('returns 0 when point is on the segment', () => {
    const dist = distanceToSegment({ x: 0, y: 50 }, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(dist).toBeCloseTo(0);
  });

  it('returns correct distance for a point beside a vertical segment', () => {
    const dist = distanceToSegment({ x: 30, y: 50 }, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(dist).toBeCloseTo(30);
  });

  it('returns distance to nearest endpoint when point is beyond segment', () => {
    const dist = distanceToSegment({ x: 0, y: -50 }, { x: 0, y: 0 }, { x: 0, y: 100 });
    expect(dist).toBeCloseTo(50);
  });

  it('handles zero-length segment', () => {
    const dist = distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(dist).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// findNearestEdge
// ---------------------------------------------------------------------------

describe('findNearestEdge', () => {
  it('finds the nearest edge when drop is in the gap between nodes', () => {
    // Drop at x=220 (center of nodes), y=130 — in the gap between node 1 (ends at y=60) and node 2 (starts at y=200)
    // Edge e1-2 runs vertically from ~(220, 60) to ~(220, 200)
    const result = findNearestEdge(NODES, EDGES, { x: 220, y: 130 }, 80);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('e1-2');
  });

  it('finds the correct edge when between second pair', () => {
    // Drop at x=220, y=330 — gap between node 2 (ends at y=260) and node 3 (starts at y=400)
    const result = findNearestEdge(NODES, EDGES, { x: 220, y: 330 }, 80);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('e2-3');
  });

  it('returns null when drop is far from all edges', () => {
    const result = findNearestEdge(NODES, EDGES, { x: 1000, y: 1000 }, 80);
    expect(result).toBeNull();
  });

  it('returns null for empty edges', () => {
    const result = findNearestEdge(NODES, [], { x: 220, y: 130 }, 80);
    expect(result).toBeNull();
  });

  it('returns null when cursor is over an existing node (prevents card-hover activation)', () => {
    // Drop at x=200, y=220 — this is inside node 2 (top-left 100,200, size ~240x60)
    const result = findNearestEdge(NODES, EDGES, { x: 200, y: 220 }, 80);
    expect(result).toBeNull();
  });

  it('returns null when cursor is over the source node', () => {
    // Drop at x=200, y=30 — inside node 1 (top-left 100,0)
    const result = findNearestEdge(NODES, EDGES, { x: 200, y: 30 }, 80);
    expect(result).toBeNull();
  });

  it('detects edge from both left and right sides equally', () => {
    // Edge e1-2 center line is at x≈220
    // Drop 40px to the left of center
    const leftResult = findNearestEdge(NODES, EDGES, { x: 180, y: 130 }, 80);
    // Drop 40px to the right of center
    const rightResult = findNearestEdge(NODES, EDGES, { x: 260, y: 130 }, 80);

    // Both should detect e1-2
    expect(leftResult).not.toBeNull();
    expect(leftResult!.id).toBe('e1-2');
    expect(rightResult).not.toBeNull();
    expect(rightResult!.id).toBe('e1-2');
  });

  it('respects threshold distance', () => {
    // Drop 200px away from the edge — should not match with small threshold
    const result = findNearestEdge(NODES, EDGES, { x: 500, y: 130 }, 50);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// replaceOutgoingEdge
// ---------------------------------------------------------------------------

describe('replaceOutgoingEdge', () => {
  it('removes existing outgoing edge and adds new one', () => {
    const newEdge: AutomationEdge = {
      id: 'e2-new',
      source: '2',
      target: '99',
      type: 'smoothstep',
    };
    const result = replaceOutgoingEdge(EDGES, '2', newEdge);

    expect(result.find((e) => e.id === 'e2-3')).toBeUndefined();
    expect(result.find((e) => e.id === 'e2-new')).toBeDefined();
    expect(result.find((e) => e.id === 'e1-2')).toBeDefined();
    expect(result.find((e) => e.id === 'e3-4')).toBeDefined();
  });

  it('adds edge when source has no existing outgoing edges', () => {
    const newEdge: AutomationEdge = {
      id: 'e99-100',
      source: '99',
      target: '100',
      type: 'smoothstep',
    };
    const result = replaceOutgoingEdge(EDGES, '99', newEdge);
    expect(result).toHaveLength(EDGES.length + 1);
  });
});

// ---------------------------------------------------------------------------
// spliceNodeIntoEdge
// ---------------------------------------------------------------------------

describe('spliceNodeIntoEdge', () => {
  it('removes the original edge and creates two new ones', () => {
    const result = spliceNodeIntoEdge(EDGES, EDGES[1], '99');

    expect(result.find((e) => e.id === 'e2-3')).toBeUndefined();

    const newEdge1 = result.find((e) => e.source === '2' && e.target === '99');
    const newEdge2 = result.find((e) => e.source === '99' && e.target === '3');
    expect(newEdge1).toBeDefined();
    expect(newEdge2).toBeDefined();
    expect(newEdge1!.type).toBe('smoothstep');

    expect(result.find((e) => e.id === 'e1-2')).toBeDefined();
    expect(result.find((e) => e.id === 'e3-4')).toBeDefined();
  });

  it('results in correct edge count', () => {
    const result = spliceNodeIntoEdge(EDGES, EDGES[0], '50');
    // 3 - 1 removed + 2 added = 4
    expect(result).toHaveLength(4);
  });
});
