import { useState } from 'react';
import { Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddProviderModal } from './add-provider-modal';
import { SendgridFormModal } from './sendgrid-form-modal';
import { useAccountId, useUpdateAccountConfigs } from '../use-settings';
import { useEmailProviders, type ProviderState } from './use-email-providers';
import { getProviderLabel } from './provider-registry';
import { accountSendgridGateway } from './sendgrid-account-gateway';
import { accountMailersendGateway } from './mailersend-account-gateway';
import { accountSparkpostGateway } from './sparkpost-account-gateway';
import { accountResendGateway } from './resend-account-gateway';
import { accountMandrillGateway } from './mandrill-account-gateway';
import { accountSesGateway } from './amazon-ses-account-gateway';
import { mapProviderError } from './provider-error-toast';

const PROVIDER_REMOVERS: Record<string, { label: string; remove: (accountId: number) => Promise<void> }> = {
  sendgrid: { label: 'SendGrid', remove: (id) => accountSendgridGateway.remove(id) },
  mailersend: { label: 'MailerSend', remove: (id) => accountMailersendGateway.remove(id) },
  sparkpost: { label: 'SparkPost', remove: (id) => accountSparkpostGateway.remove(id) },
  resend: { label: 'Resend', remove: (id) => accountResendGateway.remove(id) },
  mandrill: { label: 'Mandrill', remove: (id) => accountMandrillGateway.remove(id) },
  ses: { label: 'Amazon SES', remove: (id) => accountSesGateway.remove(id) },
};

export function EmailProvidersTab() {
  const accountId = useAccountId();
  const { configuredProviders, defaultProvider, isLoading, isError, refresh } = useEmailProviders();
  const updateConfigs = useUpdateAccountConfigs();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formModal, setFormModal] = useState<{ type: 'sendgrid'; mode: 'create' | 'edit' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [defaultSwapping, setDefaultSwapping] = useState<string | null>(null);

  const sendgridConfigured = configuredProviders.some((p) => p.name === 'sendgrid');
  // EVO-1462 AC7: with SendGrid as the only exposed type and 1-per-type rule,
  // the CTA is disabled once SendGrid is configured.
  const ctaDisabled = sendgridConfigured;
  const onlyOneConfigured = configuredProviders.length === 1;

  function openAddModal() {
    setAddModalOpen(true);
  }

  function handleSelectType(name: string) {
    setAddModalOpen(false);
    if (name === 'sendgrid') setFormModal({ type: 'sendgrid', mode: 'create' });
  }

  function handleEdit(name: string) {
    if (name === 'sendgrid') setFormModal({ type: 'sendgrid', mode: 'edit' });
  }

  async function handleSetDefault(name: string) {
    if (defaultProvider === name) return;
    setDefaultSwapping(name);
    try {
      await updateConfigs.mutateAsync({
        accountId,
        configs: [{ account_id: accountId, name: 'default_email_provider', value: name }],
      });
      toast.success(`${getProviderLabel(name)} agora é o provider default.`);
      refresh();
    } catch {
      // useUpdateAccountConfigs surfaces the error toast.
    } finally {
      setDefaultSwapping(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const remover = PROVIDER_REMOVERS[deleteTarget.name];
    if (!remover) return;
    setDeleting(true);
    try {
      await remover.remove(accountId);
      toast.success(`${remover.label} removido.`);
      refresh();
      setDeleteTarget(null);
    } catch (err) {
      toast.error(mapProviderError(err, remover.label));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Email providers</h2>
            <p className="text-muted-foreground text-sm">
              Providers configurados para envio de email a partir desta conta.
            </p>
          </div>
          {ctaDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled data-testid="add-provider-cta">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar email provider
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>SendGrid já configurado (1 por tipo).</TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={openAddModal} data-testid="add-provider-cta">
              <Plus className="mr-2 h-4 w-4" /> Adicionar email provider
            </Button>
          )}
        </div>

        {isError && (
          <Alert variant="destructive" data-testid="providers-list-error">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Erro ao listar email providers.</span>
              <Button size="sm" variant="outline" onClick={refresh} data-testid="providers-list-retry">
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <ProvidersTableSkeleton />
        ) : configuredProviders.length === 0 ? (
          <EmptyState onAdd={openAddModal} />
        ) : (
          <ProvidersTable
            providers={configuredProviders}
            defaultProvider={defaultProvider}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
            onSetDefault={handleSetDefault}
            disableDelete={onlyOneConfigured}
            defaultSwapping={defaultSwapping}
          />
        )}

        <AddProviderModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onSelect={handleSelectType}
        />

        <SendgridFormModal
          open={formModal?.type === 'sendgrid'}
          mode={formModal?.mode ?? 'create'}
          onOpenChange={(open) => { if (!open) setFormModal(null); }}
          onSaved={refresh}
        />

        <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover {deleteTarget ? getProviderLabel(deleteTarget.name) : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                As credenciais do provider serão removidas desta conta. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

interface ProvidersTableProps {
  providers: ProviderState[];
  defaultProvider: string | null | undefined;
  onEdit: (name: string) => void;
  onDelete: (provider: ProviderState) => void;
  onSetDefault: (name: string) => void;
  disableDelete: boolean;
  defaultSwapping: string | null;
}

function ProvidersTable({ providers, defaultProvider, onEdit, onDelete, onSetDefault, disableDelete, defaultSwapping }: ProvidersTableProps) {
  return (
    <Table data-testid="providers-table">
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Default</TableHead>
          <TableHead>Último teste</TableHead>
          <TableHead className="w-12 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {providers.map((p) => (
          <TableRow key={p.name} data-testid={`provider-row-${p.name}`}>
            <TableCell className="font-medium">
              {p.label}
              {p.fromDomain && (
                <span className="text-muted-foreground block text-xs font-normal" data-testid={`provider-domain-${p.name}`}>
                  {p.fromDomain}
                </span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-muted-foreground">Não testado</Badge>
            </TableCell>
            <TableCell>
              {defaultProvider === p.name ? (
                <Badge data-testid={`default-badge-${p.name}`}>Default</Badge>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => onSetDefault(p.name)}
                  disabled={defaultSwapping === p.name}
                  data-testid={`set-default-${p.name}`}
                >
                  {defaultSwapping === p.name ? 'Aplicando…' : 'Definir como default'}
                </Button>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">Nunca testado</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid={`row-actions-${p.name}`} aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(p.name)} data-testid={`edit-action-${p.name}`}>
                    Editar
                  </DropdownMenuItem>
                  {disableDelete ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <DropdownMenuItem disabled data-testid={`delete-action-${p.name}`}>
                            Excluir
                          </DropdownMenuItem>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Não é possível excluir o único provider configurado.</TooltipContent>
                    </Tooltip>
                  ) : (
                    <DropdownMenuItem onClick={() => onDelete(p)} data-testid={`delete-action-${p.name}`}>
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProvidersTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Default</TableHead>
          <TableHead>Último teste</TableHead>
          <TableHead className="w-12 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody data-testid="providers-table-skeleton">
        {[0, 1, 2].map((i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-6" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="border-border flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-12 text-center"
      data-testid="providers-empty-state"
    >
      <p className="font-medium">Nenhum provider configurado</p>
      <p className="text-muted-foreground text-sm">
        Configure um email provider para começar a enviar campanhas a partir desta conta.
      </p>
      <Button onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" /> Adicionar email provider
      </Button>
    </div>
  );
}

