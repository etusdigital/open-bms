import { useState, useCallback, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type OnConnect,
  type NodeMouseHandler,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { automationNodeTypes } from './nodes';
import { findNearestEdge, spliceNodeIntoEdge } from './edge-utils';
import { EditorActionsProvider } from './editor-context';
import { StepConfigPanel } from './panels/step-config-panel';
import type {
  AutomationNode,
  AutomationEdge,
  AnyNodeData,
  AutomationEditorHandle,
  WaitSettings,
  MessageSettings,
  TestABSettings,
  TestABNodeData,
  RandomMessageSettings,
} from './types';
import { BRANCHING_STEP_TYPES, SUB_NODE_TYPES } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPLICE_THRESHOLD = 80;

const EMPTY_MESSAGE: Partial<MessageSettings> = { title: '', subject: '' };
const EMPTY_RANDOM: RandomMessageSettings = { messages: [] };

const DEFAULT_SETTINGS: Record<string, unknown> = {
  wait: { timer: 1, timerType: 'hours' } satisfies WaitSettings,
  email: EMPTY_MESSAGE as Record<string, unknown>,
  webPush: EMPTY_MESSAGE as Record<string, unknown>,
  mobilePush: EMPTY_MESSAGE as Record<string, unknown>,
  sms: EMPTY_MESSAGE as Record<string, unknown>,
  whatsapp: EMPTY_MESSAGE as Record<string, unknown>,
  testAB: {
    messages: [],
    winnerCriteria: 'open',
    status: 'notStarted',
    duration: 24,
    durationType: 'day',
  } satisfies TestABSettings as unknown as Record<string, unknown>,
  randomMessage: EMPTY_RANDOM as unknown as Record<string, unknown>,
  randomWebPush: EMPTY_RANDOM as unknown as Record<string, unknown>,
  randomMobilePush: EMPTY_RANDOM as unknown as Record<string, unknown>,
  addTag: [] as unknown as Record<string, unknown>,
  removeTag: [] as unknown as Record<string, unknown>,
  updateCustomField: { customFieldValue: '', customFieldSelected: null } as unknown as Record<string, unknown>,
  contactTransfer: { accountId: 0, accountName: '', tagId: 0, tagName: '', apiKey: '' },
  removeAutomation: { automations: [] },
  httpRequest: {
    operation: 'get',
    url: '',
    headers: [],
    body: [],
    queryString: '',
    newTry: false,
    quantityTry: 0,
  },
  split: { '1': 50, '2': 50 },
  conditionalTime: { initialTime: 9, endTime: 18 },
  conditional: [],
  end: {},
};

/** Step types that auto-create sub-nodes when dropped */
const COMPOUND_STEP_TYPES = new Set(['split', 'conditional']);

// Highlighted edge style
const HIGHLIGHT_STYLE = { stroke: '#3b82f6', strokeWidth: 3, strokeDasharray: '8 4' };
const NORMAL_STYLE = {};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AutomationEditorProps {
  initialNodes: AutomationNode[];
  initialEdges: AutomationEdge[];
  initialStepIdCounter: number;
  initialViewport?: { x: number; y: number; zoom: number };
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  messageStats?: Record<string, Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlowProvider ancestor)
// ---------------------------------------------------------------------------

const AutomationEditorInner = forwardRef<AutomationEditorHandle, AutomationEditorProps>(function AutomationEditorInner(
  {
    initialNodes,
    initialEdges,
    initialStepIdCounter,
    initialViewport,
    onDirtyChange,
    readOnly = false,
    messageStats = {},
  },
  ref,
) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState(initialEdges);

  // Wrap onEdgesChange to protect structural edges (conditional→yes/no, split→splitPath)
  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeRaw>[0]) => {
      const filteredChanges = changes.filter((change) => {
        if (change.type !== 'remove') return true;
        const edge = edgesRef.current.find((e) => e.id === change.id);
        if (!edge) return true;
        const targetNode = nodesRef.current.find((n) => n.id === edge.target);
        if (targetNode && SUB_NODE_TYPES.has(targetNode.type ?? '')) return false;
        return true;
      });
      if (filteredChanges.length > 0) onEdgesChangeRaw(filteredChanges);
    },
    [onEdgesChangeRaw],
  );
  const [stepIdCounter, setStepIdCounter] = useState(initialStepIdCounter);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Track the edge being hovered during drag for visual highlight
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);

  // Step validation error highlight
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);

  // Use refs for latest nodes/edges to avoid stale closures in drag handlers
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const markDirty = useCallback(() => {
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  // -----------------------------------------------------------------------
  // Expose state to parent via ref
  // -----------------------------------------------------------------------

  useImperativeHandle(
    ref,
    () => ({
      getState: () => ({
        nodes,
        edges,
        stepIdCounter,
        viewport: reactFlowInstance?.getViewport(),
      }),
      highlightError: (stepId: number) => {
        const nodeId = String(stepId);
        setErrorNodeId(nodeId);
        // Zoom to the erroring node
        const node = nodesRef.current.find((n) => n.id === nodeId || n.data.stepId === stepId);
        if (node && reactFlowInstance) {
          reactFlowInstance.setCenter(node.position.x + 120, node.position.y + 30, {
            zoom: 1,
            duration: 500,
          });
        }
      },
      clearError: () => setErrorNodeId(null),
    }),
    [nodes, edges, stepIdCounter, reactFlowInstance],
  );

  // -----------------------------------------------------------------------
  // Node click → open config panel
  // -----------------------------------------------------------------------

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (
      node.type === 'end' ||
      node.type === 'unsupported' ||
      SUB_NODE_TYPES.has(node.type ?? '')
    )
      return;
    // Block editing testAB when running or finished
    if (node.type === 'testAB') {
      const status = (node.data as TestABNodeData).settings?.status;
      if (status === 'running' || status === 'finished') return;
    }
    setSelectedNodeId(node.id);
  }, []);

  // -----------------------------------------------------------------------
  // Connect nodes (single-output constraint)
  // -----------------------------------------------------------------------

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (readOnly || !connection.source || !connection.target) return;

      // Block connecting branching handles (yes/no, path-N) to anything other
      // than their structural sub-nodes — users should connect FROM sub-nodes, not replace them
      const sourceNode = nodesRef.current.find((n) => n.id === connection.source);
      const isBranching = sourceNode && BRANCHING_STEP_TYPES.has(sourceNode.type ?? '');
      if (isBranching && connection.sourceHandle) {
        // Check if this handle already connects to a sub-node — if so, block
        const existingEdge = edgesRef.current.find(
          (e) => e.source === connection.source && e.sourceHandle === connection.sourceHandle,
        );
        if (existingEdge) {
          const existingTarget = nodesRef.current.find((n) => n.id === existingEdge.target);
          if (existingTarget && SUB_NODE_TYPES.has(existingTarget.type ?? '')) {
            return; // Block: can't disconnect from structural sub-node
          }
        }
      }

      // Block connecting TO a sub-node from anything other than its parent
      const targetNode = nodesRef.current.find((n) => n.id === connection.target);
      if (targetNode && SUB_NODE_TYPES.has(targetNode.type ?? '')) {
        return; // Block: sub-nodes can only receive from their parent
      }

      setEdges((eds) => {
        const filtered = isBranching
          ? eds.filter((e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle))
          : eds.filter((e) => e.source !== connection.source);

        return addEdge({ ...connection, type: 'smoothstep' }, filtered);
      });
      markDirty();
    },
    [readOnly, setEdges, markDirty],
  );

  // -----------------------------------------------------------------------
  // Drag over: detect nearest edge and highlight it
  // -----------------------------------------------------------------------

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      // Convert screen position to flow position for edge detection
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nearest = findNearestEdge(nodesRef.current, edgesRef.current, position, SPLICE_THRESHOLD);

      setHighlightedEdgeId(nearest?.id ?? null);
    },
    [reactFlowInstance],
  );

  const onDragLeave = useCallback(() => {
    setHighlightedEdgeId(null);
  }, []);

  // -----------------------------------------------------------------------
  // Drop: create node, auto-splice if near edge
  // -----------------------------------------------------------------------

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newId = stepIdCounter + 1;
      const newNodeId = String(newId);
      const newNode: AutomationNode = {
        id: newNodeId,
        type,
        position,
        data: {
          stepId: newId,
          settings: DEFAULT_SETTINGS[type] ?? {},
        } as AnyNodeData,
      };

      // Use refs for fresh values (avoid stale closure)
      const splicedEdge = findNearestEdge(nodesRef.current, edgesRef.current, position, SPLICE_THRESHOLD);

      // For compound types (split, conditional), auto-create sub-nodes
      if (COMPOUND_STEP_TYPES.has(type)) {
        const subNodes: AutomationNode[] = [newNode];
        const subEdges: AutomationEdge[] = [];
        let nextId = newId;

        // Hoist IDs so splice logic below can reference the first path
        let pathA_id: string | undefined;
        let endA_id: number | undefined;
        let trueId: string | undefined;
        let endTrue: number | undefined;

        if (type === 'split') {
          // Create 2 splitPath nodes + 2 end nodes
          pathA_id = `path_${newId}_0`;
          const pathB_id = `path_${newId}_1`;
          endA_id = ++nextId;
          const endB_id = ++nextId;

          subNodes.push(
            {
              id: pathA_id,
              type: 'splitPath',
              position: { x: position.x - 120, y: position.y + 100 },
              data: { stepId: pathA_id, settings: { path: '1', value: 50 } } as AnyNodeData,
            },
            {
              id: pathB_id,
              type: 'splitPath',
              position: { x: position.x + 120, y: position.y + 100 },
              data: { stepId: pathB_id, settings: { path: '2', value: 50 } } as AnyNodeData,
            },
            {
              id: String(endA_id),
              type: 'end',
              position: { x: position.x - 120, y: position.y + 200 },
              data: { stepId: endA_id, settings: {} } as AnyNodeData,
            },
            {
              id: String(endB_id),
              type: 'end',
              position: { x: position.x + 120, y: position.y + 200 },
              data: { stepId: endB_id, settings: {} } as AnyNodeData,
            },
          );
          subEdges.push(
            {
              id: `e${newNodeId}-${pathA_id}`,
              source: newNodeId,
              target: pathA_id,
              type: 'smoothstep',
              sourceHandle: 'path-1',
            },
            {
              id: `e${newNodeId}-${pathB_id}`,
              source: newNodeId,
              target: pathB_id,
              type: 'smoothstep',
              sourceHandle: 'path-2',
            },
            {
              id: `e${pathA_id}-${endA_id}`,
              source: pathA_id,
              target: String(endA_id),
              type: 'smoothstep',
            },
            {
              id: `e${pathB_id}-${endB_id}`,
              source: pathB_id,
              target: String(endB_id),
              type: 'smoothstep',
            },
          );
        } else if (type === 'conditional') {
          // Create conditionalTrue + conditionalFalse + 2 end nodes
          trueId = `conditional_${newId}_1`;
          const falseId = `conditional_${newId}_2`;
          endTrue = ++nextId;
          const endFalse = ++nextId;

          subNodes.push(
            {
              id: trueId,
              type: 'conditionalTrue',
              position: { x: position.x - 100, y: position.y + 100 },
              data: { stepId: trueId, settings: [] } as AnyNodeData,
            },
            {
              id: falseId,
              type: 'conditionalFalse',
              position: { x: position.x + 100, y: position.y + 100 },
              data: { stepId: falseId, settings: {} } as AnyNodeData,
            },
            {
              id: String(endTrue),
              type: 'end',
              position: { x: position.x - 100, y: position.y + 200 },
              data: { stepId: endTrue, settings: {} } as AnyNodeData,
            },
            {
              id: String(endFalse),
              type: 'end',
              position: { x: position.x + 100, y: position.y + 200 },
              data: { stepId: endFalse, settings: {} } as AnyNodeData,
            },
          );
          subEdges.push(
            {
              id: `e${newNodeId}-${trueId}`,
              source: newNodeId,
              target: trueId,
              type: 'smoothstep',
              sourceHandle: 'yes',
            },
            {
              id: `e${newNodeId}-${falseId}`,
              source: newNodeId,
              target: falseId,
              type: 'smoothstep',
              sourceHandle: 'no',
            },
            {
              id: `e${trueId}-${endTrue}`,
              source: trueId,
              target: String(endTrue),
              type: 'smoothstep',
            },
            {
              id: `e${falseId}-${endFalse}`,
              source: falseId,
              target: String(endFalse),
              type: 'smoothstep',
            },
          );
        }

        if (splicedEdge) {
          // When splicing a compound node into an edge (e.g. Wait → AddTag),
          // route the downstream node through the first path:
          //   Wait → Split → A(50%) → AddTag → End
          //   B(50%) stays separate with its own End
          const firstPathId = type === 'split' ? pathA_id! : trueId!;
          const firstEndId = type === 'split' ? String(endA_id!) : String(endTrue!);

          // Replace the default end node edge on path A/Yes with downstream target
          const patchedSubEdges = subEdges.map((e) =>
            e.source === firstPathId && e.target === firstEndId
              ? { ...e, id: `e${firstPathId}-${splicedEdge.target}`, target: splicedEdge.target }
              : e,
          );

          // Remove the now-unnecessary end node from path A/Yes
          const patchedSubNodes = subNodes.filter((n) => n.id !== firstEndId);

          setNodes((nds) => [...nds, ...patchedSubNodes]);
          setEdges((eds) => {
            const withoutSpliced = eds.filter((e) => e.id !== splicedEdge.id);
            return [
              ...withoutSpliced,
              {
                id: `e${splicedEdge.source}-${newNodeId}`,
                source: splicedEdge.source,
                target: newNodeId,
                type: 'smoothstep' as const,
              },
              ...patchedSubEdges,
            ];
          });
        } else {
          setNodes((nds) => [...nds, ...subNodes]);
          setEdges((eds) => [...eds, ...subEdges]);
        }
        setStepIdCounter(nextId);
      } else {
        // Regular node drop
        setNodes((nds) => [...nds, newNode]);

        if (splicedEdge) {
          setEdges((eds) => spliceNodeIntoEdge(eds, splicedEdge, newNodeId));
        }

        setStepIdCounter(newId);
      }

      setHighlightedEdgeId(null);
      markDirty();
    },
    [readOnly, reactFlowInstance, stepIdCounter, setNodes, setEdges, markDirty],
  );

  // -----------------------------------------------------------------------
  // Delete node
  // -----------------------------------------------------------------------

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;

      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node || node.type === 'trigger') return;

      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      // For branching nodes (split/conditional), collect all sub-nodes to delete
      const isBranchingNode = BRANCHING_STEP_TYPES.has(node.type ?? '');
      const nodeIdsToRemove = new Set<string>([nodeId]);

      if (isBranchingNode) {
        // Find direct sub-nodes (splitPath, conditionalTrue/False)
        const subEdges = currentEdges.filter((e) => e.source === nodeId);
        for (const edge of subEdges) {
          const targetNode = currentNodes.find((n) => n.id === edge.target);
          if (targetNode && SUB_NODE_TYPES.has(targetNode.type ?? '')) {
            nodeIdsToRemove.add(targetNode.id);
            // Also collect downstream end nodes auto-created with the branch
            const downstreamEdges = currentEdges.filter((e) => e.source === targetNode.id);
            for (const de of downstreamEdges) {
              const downstream = currentNodes.find((n) => n.id === de.target);
              if (downstream?.type === 'end') {
                nodeIdsToRemove.add(downstream.id);
              }
            }
          }
        }
      }

      // Find the incoming edge to the deleted node (for reconnection)
      const incomingEdge = currentEdges.find((e) => e.target === nodeId);

      setNodes((nds) => nds.filter((n) => !nodeIdsToRemove.has(n.id)));
      setEdges((eds) => {
        // Remove all edges connected to any of the deleted nodes
        const filtered = eds.filter((e) => !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target));
        // For non-branching nodes, reconnect parent to child
        if (!isBranchingNode && incomingEdge) {
          const outgoingEdge = currentEdges.find((e) => e.source === nodeId);
          if (outgoingEdge) {
            filtered.push({
              id: `e${incomingEdge.source}-${outgoingEdge.target}`,
              source: incomingEdge.source,
              target: outgoingEdge.target,
              type: 'smoothstep',
            });
          }
        }
        return filtered;
      });

      setSelectedNodeId(null);
      markDirty();
    },
    [readOnly, setNodes, setEdges, markDirty],
  );

  // -----------------------------------------------------------------------
  // Update node settings
  // -----------------------------------------------------------------------

  const handleUpdateNodeSettings = useCallback(
    (settings: Record<string, unknown>) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, settings } as AnyNodeData } : n)),
      );
      markDirty();
    },
    [selectedNodeId, setNodes, markDirty],
  );

  // -----------------------------------------------------------------------
  // Apply edge highlighting
  // -----------------------------------------------------------------------

  const styledEdges = useMemo(
    () =>
      highlightedEdgeId
        ? edges.map((e) =>
            e.id === highlightedEdgeId
              ? { ...e, style: HIGHLIGHT_STYLE, animated: true }
              : { ...e, style: NORMAL_STYLE, animated: false },
          )
        : edges,
    [edges, highlightedEdgeId],
  );

  // Apply error highlight to the erroring node
  const styledNodes = useMemo(
    () =>
      errorNodeId
        ? nodes.map((n) =>
            n.id === errorNodeId ? { ...n, className: 'ring-2 ring-red-500 ring-offset-2 rounded-lg' } : n,
          )
        : nodes,
    [nodes, errorNodeId],
  );

  // -----------------------------------------------------------------------
  // Selected node info
  // -----------------------------------------------------------------------

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  // -----------------------------------------------------------------------
  // Sync split paths: add/remove splitPath + end nodes when config changes
  // -----------------------------------------------------------------------

  const syncSplitPaths = useCallback(
    (splitNodeId: string, paths: Array<{ key: string; value: number }>) => {
      if (readOnly) return;

      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const splitNode = currentNodes.find((n) => n.id === splitNodeId);
      if (!splitNode) return;

      // Find existing splitPath nodes for this split
      const existingPathEdges = currentEdges.filter(
        (e) => e.source === splitNodeId && e.sourceHandle?.startsWith('path-'),
      );
      const existingPathNodeIds = new Set(existingPathEdges.map((e) => e.target));

      // Build desired path IDs
      const desiredPaths = paths.map((p, i) => ({
        ...p,
        nodeId: `path_${splitNodeId}_${i}`,
        handleId: `path-${p.key}`,
      }));
      const desiredPathNodeIds = new Set(desiredPaths.map((p) => p.nodeId));

      // Paths to add (not yet existing)
      const toAdd = desiredPaths.filter((p) => !existingPathNodeIds.has(p.nodeId));
      // Paths to remove (existing but no longer desired)
      const toRemove = [...existingPathNodeIds].filter((id) => !desiredPathNodeIds.has(id));

      let nextStepId = stepIdCounter;

      // Create new splitPath + end nodes
      const newNodes: AutomationNode[] = [];
      const newEdges: AutomationEdge[] = [];

      for (const p of toAdd) {
        const pathIndex = desiredPaths.indexOf(p);
        const xOffset = (pathIndex - (desiredPaths.length - 1) / 2) * 200;
        const endId = ++nextStepId;

        newNodes.push(
          {
            id: p.nodeId,
            type: 'splitPath',
            position: { x: splitNode.position.x + xOffset, y: splitNode.position.y + 100 },
            data: { stepId: p.nodeId, settings: { path: p.key, value: p.value } } as AnyNodeData,
          },
          {
            id: String(endId),
            type: 'end',
            position: { x: splitNode.position.x + xOffset, y: splitNode.position.y + 200 },
            data: { stepId: endId, settings: {} } as AnyNodeData,
          },
        );
        newEdges.push(
          {
            id: `e${splitNodeId}-${p.nodeId}`,
            source: splitNodeId,
            target: p.nodeId,
            type: 'smoothstep',
            sourceHandle: p.handleId,
          },
          {
            id: `e${p.nodeId}-${endId}`,
            source: p.nodeId,
            target: String(endId),
            type: 'smoothstep',
          },
        );
      }

      // Update existing splitPath nodes with new percentages
      setNodes((nds) => {
        const updated = nds
          // Remove nodes that belong to removed paths (and their downstream end nodes)
          .filter((n) => {
            if (toRemove.includes(n.id)) return false;
            // Also remove end nodes connected only from removed paths
            const inEdge = currentEdges.find((e) => e.target === n.id);
            if (inEdge && toRemove.includes(inEdge.source) && n.type === 'end') return false;
            return true;
          })
          // Update existing splitPath settings
          .map((n) => {
            const desired = desiredPaths.find((p) => p.nodeId === n.id);
            if (desired && n.type === 'splitPath') {
              return {
                ...n,
                data: {
                  ...n.data,
                  settings: { path: desired.key, value: desired.value },
                } as AnyNodeData,
              };
            }
            return n;
          });

        return [...updated, ...newNodes];
      });

      // Update edges
      setEdges((eds) => {
        const filtered = eds.filter((e) => {
          // Remove edges from/to removed path nodes
          if (toRemove.includes(e.source) || toRemove.includes(e.target)) return false;
          // Remove old edges from split to removed handles
          if (e.source === splitNodeId && e.sourceHandle) {
            const handleKey = e.sourceHandle.replace('path-', '');
            if (!paths.some((p) => p.key === handleKey)) return false;
          }
          return true;
        });
        return [...filtered, ...newEdges];
      });

      if (nextStepId > stepIdCounter) setStepIdCounter(nextStepId);
      markDirty();
    },
    [readOnly, stepIdCounter, setNodes, setEdges, markDirty],
  );

  // -----------------------------------------------------------------------
  // Request delete (opens confirmation dialog)
  // -----------------------------------------------------------------------

  const onRequestDelete = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node || node.type === 'trigger') return;
      // Block delete for testAB when running
      if (node.type === 'testAB') {
        const status = (node.data as TestABNodeData).settings?.status;
        if (status === 'running') return;
      }
      setDeleteTargetId(nodeId);
    },
    [readOnly],
  );

  const confirmDelete = useCallback(() => {
    if (deleteTargetId) {
      handleDeleteNode(deleteTargetId);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, handleDeleteNode]);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Ignore shortcuts when user is typing in an input/textarea/select
      const tag = (event.target as HTMLElement).tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const node = nodesRef.current.find((n) => n.id === selectedNodeId);
        if (selectedNodeId && node?.type !== 'trigger') {
          setDeleteTargetId(selectedNodeId);
        }
      }
      if (event.key === 'Escape') {
        setSelectedNodeId(null);
      }
    },
    [selectedNodeId],
  );

  const deleteTargetNode = deleteTargetId ? nodesRef.current.find((n) => n.id === deleteTargetId) : null;

  return (
    <EditorActionsProvider
      onRequestDelete={onRequestDelete}
      syncSplitPaths={syncSplitPaths}
      errorNodeId={errorNodeId}
      messageStats={messageStats}
    >
      <div className="h-full w-full" onKeyDown={onKeyDown} tabIndex={-1}>
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          nodeTypes={automationNodeTypes}
          colorMode={resolvedTheme}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          fitView={!initialViewport}
          fitViewOptions={{ padding: 0.3 }}
          defaultViewport={initialViewport}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panOnScroll
          zoomOnDoubleClick={false}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable />
        </ReactFlow>

        {/* Config panel */}
        {selectedNode && selectedNode.type && (
          <StepConfigPanel
            key={selectedNodeId}
            open={!!selectedNodeId}
            onOpenChange={(open) => {
              if (!open) setSelectedNodeId(null);
            }}
            nodeId={selectedNodeId!}
            nodeType={selectedNode.type}
            nodeData={selectedNode.data as AnyNodeData}
            onSave={handleUpdateNodeSettings}
          />
        )}

        {/* Delete confirmation */}
        <ConfirmDialog
          open={deleteTargetId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetId(null);
          }}
          title={t('automations.editor.deleteStepTitle')}
          description={t('automations.editor.deleteStepDescription', {
            type: deleteTargetNode?.type ?? '',
          })}
          onConfirm={confirmDelete}
          variant="destructive"
          confirmLabel={t('common.delete')}
        />
      </div>
    </EditorActionsProvider>
  );
});

// ---------------------------------------------------------------------------
// Export: public API with ReactFlowProvider wrapper
// ---------------------------------------------------------------------------

export const AutomationEditor = forwardRef<AutomationEditorHandle, AutomationEditorProps>(
  function AutomationEditor(props, ref) {
    return (
      <ReactFlowProvider>
        <AutomationEditorInner ref={ref} {...props} />
      </ReactFlowProvider>
    );
  },
);
