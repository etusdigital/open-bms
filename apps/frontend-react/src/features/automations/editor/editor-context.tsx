import { createContext, useContext } from 'react';

interface EditorActions {
  onRequestDelete: (nodeId: string) => void;
  /** Sync splitPath sub-nodes when split config changes paths */
  syncSplitPaths: (splitNodeId: string, paths: Array<{ key: string; value: number }>) => void;
  /** Node ID that has a validation error (red border) */
  errorNodeId: string | null;
  /** Per-message statistics keyed by message ID */
  messageStats: Record<string, Record<string, unknown>>;
}

const EditorActionsContext = createContext<EditorActions | null>(null);

export function EditorActionsProvider({
  children,
  onRequestDelete,
  syncSplitPaths,
  errorNodeId,
  messageStats,
}: {
  children: React.ReactNode;
  onRequestDelete: (nodeId: string) => void;
  syncSplitPaths: (splitNodeId: string, paths: Array<{ key: string; value: number }>) => void;
  errorNodeId: string | null;
  messageStats: Record<string, Record<string, unknown>>;
}) {
  return (
    <EditorActionsContext value={{ onRequestDelete, syncSplitPaths, errorNodeId, messageStats }}>
      {children}
    </EditorActionsContext>
  );
}

export function useEditorActions() {
  const ctx = useContext(EditorActionsContext);
  if (!ctx) throw new Error('useEditorActions must be used within EditorActionsProvider');
  return ctx;
}
