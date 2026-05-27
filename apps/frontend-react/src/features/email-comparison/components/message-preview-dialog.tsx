import { MessagePreviewDialog as UnifiedPreviewDialog } from '@/components/message-preview-dialog';
import type { ResolvedMessage } from '../use-resolve-messages';

interface MessagePreviewDialogProps {
  message: ResolvedMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessagePreviewDialog({ message, open, onOpenChange }: MessagePreviewDialogProps) {
  if (!message) return null;

  return <UnifiedPreviewDialog messageIds={[message.id]} open={open} onOpenChange={onOpenChange} />;
}
