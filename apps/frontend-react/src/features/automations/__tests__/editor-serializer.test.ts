import { describe, it, expect } from 'vitest';
import {
  deserializeStepsToFlow,
  serializeFlowToSteps,
  layoutLinearFlow,
  deserializeWithLayout,
  buildFlowLayout,
} from '../editor/editor-serializer';
import type { ApiStep, FlowLayout } from '../editor/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_AUTOMATION: ApiStep = {
  id: 1,
  type: 'trigger',
  settings: { type: 'tag', name: 'welcome' },
  child: [{ id: 2, type: 'end', settings: {} as Record<string, never>, child: [] }],
};

const LINEAR_AUTOMATION: ApiStep = {
  id: 1,
  type: 'trigger',
  settings: { type: 'tag', name: 'onboarding' },
  child: [
    {
      id: 2,
      type: 'wait',
      settings: { timer: 24, timerType: 'hours' },
      child: [
        {
          id: 3,
          type: 'email',
          settings: { id: 10, name: 'welcome-email', title: 'Welcome!', subject: 'Hello' },
          child: [{ id: 4, type: 'end', settings: {} as Record<string, never>, child: [] }],
        },
      ],
    },
  ],
};

const DEEP_AUTOMATION: ApiStep = {
  id: 1,
  type: 'trigger',
  settings: { type: 'events', eventType: 'open' },
  child: [
    {
      id: 2,
      type: 'wait',
      settings: { timer: 1, timerType: 'hours' },
      child: [
        {
          id: 3,
          type: 'email',
          settings: { id: 5, name: 'followup-1' },
          child: [
            {
              id: 4,
              type: 'wait',
              settings: { timer: 48, timerType: 'hours' },
              child: [
                {
                  id: 5,
                  type: 'email',
                  settings: { id: 6, name: 'followup-2' },
                  child: [{ id: 6, type: 'end', settings: {} as Record<string, never>, child: [] }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const UNSUPPORTED_STEP_AUTOMATION: ApiStep = {
  id: 1,
  type: 'trigger',
  settings: { type: 'tag', name: 'test' },
  child: [
    {
      id: 2,
      type: 'someUnknownFutureStep',
      settings: { foo: 'bar' },
      child: [{ id: 3, type: 'end', settings: {} as Record<string, never>, child: [] }],
    },
  ],
} as ApiStep;

// ---------------------------------------------------------------------------
// Deserialize tests
// ---------------------------------------------------------------------------

describe('deserializeStepsToFlow', () => {
  it('deserializes a minimal automation (trigger + end)', () => {
    const result = deserializeStepsToFlow(MINIMAL_AUTOMATION);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.maxStepId).toBe(2);

    expect(result.nodes[0].type).toBe('trigger');
    expect(result.nodes[0].id).toBe('1');
    expect(result.nodes[1].type).toBe('end');
    expect(result.nodes[1].id).toBe('2');

    expect(result.edges[0]).toEqual({
      id: 'e1-2',
      source: '1',
      target: '2',
      type: 'smoothstep',
    });
  });

  it('deserializes a linear automation (trigger → wait → email → end)', () => {
    const result = deserializeStepsToFlow(LINEAR_AUTOMATION);

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
    expect(result.maxStepId).toBe(4);

    const types = result.nodes.map((n) => n.type);
    expect(types).toEqual(['trigger', 'wait', 'email', 'end']);
  });

  it('deserializes a deep automation (6 levels)', () => {
    const result = deserializeStepsToFlow(DEEP_AUTOMATION);

    expect(result.nodes).toHaveLength(6);
    expect(result.edges).toHaveLength(5);
    expect(result.maxStepId).toBe(6);
  });

  it('marks unsupported step types', () => {
    const result = deserializeStepsToFlow(UNSUPPORTED_STEP_AUTOMATION);

    expect(result.nodes).toHaveLength(3);
    const addTagNode = result.nodes[1];
    expect(addTagNode.type).toBe('unsupported');
    expect((addTagNode.data as { originalType: string }).originalType).toBe('someUnknownFutureStep');
  });

  it('assigns incrementing Y positions', () => {
    const result = deserializeStepsToFlow(LINEAR_AUTOMATION);

    const yPositions = result.nodes.map((n) => n.position.y);
    for (let i = 1; i < yPositions.length; i++) {
      expect(yPositions[i]).toBeGreaterThan(yPositions[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Serialize tests
// ---------------------------------------------------------------------------

describe('serializeFlowToSteps', () => {
  it('serializes a minimal flow back to a tree', () => {
    const { nodes, edges } = deserializeStepsToFlow(MINIMAL_AUTOMATION);
    const result = serializeFlowToSteps(nodes, edges);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.root.id).toBe(1);
    expect(result.root.type).toBe('trigger');
    expect(result.root.child).toHaveLength(1);
    expect(result.root.child[0].type).toBe('end');
  });

  it('returns error for empty nodes', () => {
    const result = serializeFlowToSteps([], []);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('No nodes');
  });

  it('returns error when all nodes have incoming edges (cycle)', () => {
    const nodes = [
      { id: '1', type: 'trigger', position: { x: 0, y: 0 }, data: { stepId: 1, settings: {} } },
      { id: '2', type: 'end', position: { x: 0, y: 150 }, data: { stepId: 2, settings: {} } },
    ];
    const edges = [
      { id: 'e1-2', source: '1', target: '2', type: 'addStepEdge' },
      { id: 'e2-1', source: '2', target: '1', type: 'addStepEdge' },
    ];
    const result = serializeFlowToSteps(nodes, edges);
    expect(result.success).toBe(false);
  });

  it('preserves unsupported step types through serialization', () => {
    const { nodes, edges } = deserializeStepsToFlow(UNSUPPORTED_STEP_AUTOMATION);
    const result = serializeFlowToSteps(nodes, edges);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.root.child[0].type).toBe('someUnknownFutureStep');
  });
});

// ---------------------------------------------------------------------------
// Roundtrip tests
// ---------------------------------------------------------------------------

describe('roundtrip: deserialize → serialize', () => {
  it('roundtrips a minimal automation', () => {
    const { nodes, edges } = deserializeStepsToFlow(MINIMAL_AUTOMATION);
    const result = serializeFlowToSteps(nodes, edges);

    expect(result.success).toBe(true);
    if (!result.success) return;

    assertTreeEquality(result.root, MINIMAL_AUTOMATION);
  });

  it('roundtrips a linear automation', () => {
    const { nodes, edges } = deserializeStepsToFlow(LINEAR_AUTOMATION);
    const result = serializeFlowToSteps(nodes, edges);

    expect(result.success).toBe(true);
    if (!result.success) return;

    assertTreeEquality(result.root, LINEAR_AUTOMATION);
  });

  it('roundtrips a deep automation', () => {
    const { nodes, edges } = deserializeStepsToFlow(DEEP_AUTOMATION);
    const result = serializeFlowToSteps(nodes, edges);

    expect(result.success).toBe(true);
    if (!result.success) return;

    assertTreeEquality(result.root, DEEP_AUTOMATION);
  });

  it('roundtrips an automation with unsupported steps', () => {
    const { nodes, edges } = deserializeStepsToFlow(UNSUPPORTED_STEP_AUTOMATION);
    const result = serializeFlowToSteps(nodes, edges);

    expect(result.success).toBe(true);
    if (!result.success) return;

    assertTreeEquality(result.root, UNSUPPORTED_STEP_AUTOMATION);
  });
});

// ---------------------------------------------------------------------------
// Layout tests
// ---------------------------------------------------------------------------

describe('layoutLinearFlow', () => {
  it('positions nodes vertically in graph order', () => {
    const { nodes, edges } = deserializeStepsToFlow(LINEAR_AUTOMATION);
    const laid = layoutLinearFlow(nodes, edges);

    expect(laid[0].position.y).toBe(0);
    for (let i = 1; i < laid.length; i++) {
      expect(laid[i].position.y).toBeGreaterThan(laid[i - 1].position.y);
    }
  });

  it('handles empty input', () => {
    expect(layoutLinearFlow([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deserializeWithLayout tests
// ---------------------------------------------------------------------------

describe('deserializeWithLayout', () => {
  it('falls back to auto-layout when flowLayout is null', () => {
    const result = deserializeWithLayout(LINEAR_AUTOMATION, null);
    expect(result.nodes).toHaveLength(4);
    // Auto-layout positions (y increments)
    expect(result.nodes[0].position.y).toBe(0);
  });

  it('restores persisted positions', () => {
    const layout: FlowLayout = {
      nodes: [
        { id: '1', position: { x: 100, y: 200 } },
        { id: '2', position: { x: 300, y: 400 } },
        { id: '3', position: { x: 100, y: 600 } },
        { id: '4', position: { x: 100, y: 800 } },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
      ],
    };

    const result = deserializeWithLayout(LINEAR_AUTOMATION, layout);

    expect(result.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(result.nodes[1].position).toEqual({ x: 300, y: 400 });
  });

  it('uses persisted edges when available', () => {
    const layout: FlowLayout = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 } },
        { id: '2', position: { x: 0, y: 150 } },
      ],
      edges: [{ id: 'custom-edge', source: '1', target: '2' }],
    };

    const result = deserializeWithLayout(MINIMAL_AUTOMATION, layout);
    expect(result.edges[0].id).toBe('custom-edge');
    expect(result.edges[0].type).toBe('smoothstep');
  });

  it('falls back to tree-derived edges when layout has no edges', () => {
    const layout: FlowLayout = {
      nodes: [{ id: '1', position: { x: 50, y: 50 } }],
      edges: [],
    };

    const result = deserializeWithLayout(MINIMAL_AUTOMATION, layout);
    // Should use tree-derived edges
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('1');
    expect(result.edges[0].target).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// buildFlowLayout tests
// ---------------------------------------------------------------------------

describe('buildFlowLayout', () => {
  it('builds layout from nodes and edges', () => {
    const { nodes, edges } = deserializeStepsToFlow(MINIMAL_AUTOMATION);
    const layout = buildFlowLayout(nodes, edges, { x: 0, y: 0, zoom: 1 });

    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
    expect(layout.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertTreeEquality(actual: ApiStep, expected: ApiStep) {
  expect(actual.id).toBe(expected.id);
  expect(actual.type).toBe(expected.type);
  expect(actual.settings).toEqual(expected.settings);
  expect(actual.child.length).toBe(expected.child.length);
  for (let i = 0; i < actual.child.length; i++) {
    assertTreeEquality(actual.child[i], expected.child[i]);
  }
}
