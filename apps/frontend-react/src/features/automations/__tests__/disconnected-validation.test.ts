import { describe, it, expect } from 'vitest';
import type { AutomationNode, AutomationEdge } from '../editor/types';

/**
 * Replicates the disconnected-node validation logic from automation-form-page.tsx.
 * A node is disconnected if it's not the trigger and has no incoming edge.
 */
function findDisconnectedNode(nodes: AutomationNode[], edges: AutomationEdge[]): AutomationNode | undefined {
  const targetIds = new Set(edges.map((e) => e.target));
  return nodes.find((n) => n.type !== 'trigger' && !targetIds.has(n.id));
}

function makeNode(id: string, type: string): AutomationNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { stepId: Number(id) || 0, settings: {} },
  } as AutomationNode;
}

function makeEdge(source: string, target: string): AutomationEdge {
  return { id: `e${source}-${target}`, source, target, type: 'smoothstep' };
}

describe('disconnected node validation', () => {
  it('returns undefined for a fully connected flow', () => {
    const nodes = [makeNode('1', 'trigger'), makeNode('2', 'wait'), makeNode('3', 'end')];
    const edges = [makeEdge('1', '2'), makeEdge('2', '3')];
    expect(findDisconnectedNode(nodes, edges)).toBeUndefined();
  });

  it('does not flag the trigger node (has no incoming edge by design)', () => {
    const nodes = [makeNode('1', 'trigger'), makeNode('2', 'end')];
    const edges = [makeEdge('1', '2')];
    expect(findDisconnectedNode(nodes, edges)).toBeUndefined();
  });

  it('detects a node with no incoming edge', () => {
    const nodes = [makeNode('1', 'trigger'), makeNode('2', 'wait'), makeNode('3', 'email')];
    const edges = [makeEdge('1', '2')];
    // Node 3 has no incoming edge
    expect(findDisconnectedNode(nodes, edges)?.id).toBe('3');
  });

  it('detects orphan end node after branch deletion', () => {
    const nodes = [
      makeNode('1', 'trigger'),
      makeNode('2', 'wait'),
      makeNode('3', 'end'), // was connected to a deleted split path
    ];
    const edges = [makeEdge('1', '2')];
    expect(findDisconnectedNode(nodes, edges)?.id).toBe('3');
  });

  it('handles a single trigger node', () => {
    const nodes = [makeNode('1', 'trigger')];
    const edges: AutomationEdge[] = [];
    expect(findDisconnectedNode(nodes, edges)).toBeUndefined();
  });

  it('handles branching flows where all paths are connected', () => {
    const nodes = [
      makeNode('1', 'trigger'),
      makeNode('2', 'split'),
      makeNode('p1', 'splitPath'),
      makeNode('p2', 'splitPath'),
      makeNode('3', 'end'),
      makeNode('4', 'end'),
    ];
    const edges = [
      makeEdge('1', '2'),
      makeEdge('2', 'p1'),
      makeEdge('2', 'p2'),
      makeEdge('p1', '3'),
      makeEdge('p2', '4'),
    ];
    expect(findDisconnectedNode(nodes, edges)).toBeUndefined();
  });

  it('detects disconnected node in a branching flow', () => {
    const nodes = [
      makeNode('1', 'trigger'),
      makeNode('2', 'split'),
      makeNode('p1', 'splitPath'),
      makeNode('p2', 'splitPath'),
      makeNode('3', 'end'),
      makeNode('4', 'end'),
      makeNode('5', 'email'), // orphan
    ];
    const edges = [
      makeEdge('1', '2'),
      makeEdge('2', 'p1'),
      makeEdge('2', 'p2'),
      makeEdge('p1', '3'),
      makeEdge('p2', '4'),
    ];
    expect(findDisconnectedNode(nodes, edges)?.id).toBe('5');
  });

  it('returns the first disconnected node when multiple exist', () => {
    const nodes = [makeNode('1', 'trigger'), makeNode('2', 'wait'), makeNode('3', 'email')];
    const edges: AutomationEdge[] = [makeEdge('1', '2')];
    // Both 3 is disconnected, but node 3 is first unconnected
    const result = findDisconnectedNode(nodes, edges);
    expect(result?.id).toBe('3');
  });
});
