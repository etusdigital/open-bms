import { Trash2 } from 'lucide-react';
import { useEditorActions } from '../editor-context';

export function NodeDeleteButton({ nodeId }: { nodeId: string }) {
  const { onRequestDelete } = useEditorActions();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRequestDelete(nodeId);
      }}
      className="nodrag bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
      aria-label="Delete step"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
