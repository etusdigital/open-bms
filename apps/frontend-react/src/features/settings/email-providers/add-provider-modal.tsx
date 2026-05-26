import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EMAIL_PROVIDER_TYPES } from './provider-registry';

interface AddProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (providerName: string) => void;
}

export function AddProviderModal({ open, onOpenChange, onSelect }: AddProviderModalProps) {
  const available = EMAIL_PROVIDER_TYPES.filter((p) => p.exposed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="add-provider-modal">
        <DialogHeader>
          <DialogTitle>Adicionar email provider</DialogTitle>
          <DialogDescription>Escolha o tipo de provider para configurar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {available.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onSelect(p.name)}
              data-testid={`provider-type-${p.name}`}
              className="border-border hover:border-primary hover:bg-accent flex flex-col items-start gap-1 rounded-md border p-4 text-left transition-colors"
            >
              <span className="font-semibold">{p.label}</span>
              <span className="text-muted-foreground text-sm">{p.description}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
