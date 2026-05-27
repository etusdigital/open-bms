import { useEvolutionHubEnabled } from '@/features/feature-flags/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Wave 7.3 — "Conectar WhatsApp" page (preview).
 *
 * Renders branching by the install-wide `evolution_hub_enabled` flag so
 * the team can validate the toggle visually before waves 4 + 7.4 add the
 * real Meta SDK / EvoHub connect buttons and the channel CRUD.
 *
 * The buttons below are intentionally non-functional placeholders for this
 * wave — the wiring lands in 7.4.
 */
export default function WhatsAppConnectPage() {
  const { enabled, isLoading, isError } = useEvolutionHubEnabled();

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Conectar WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Configure os canais WhatsApp da conta usando a API oficial da Meta (Cloud API).</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Modo de instalação
            {isLoading ? <Skeleton className="h-5 w-20" /> : <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'EvoHub' : 'Meta direto'}</Badge>}
          </CardTitle>
          <CardDescription>
            Controlado pelo backend via <code className="bg-muted rounded px-1.5 py-0.5 text-xs">EVOLUTION_HUB_ENABLED</code>. Para alternar, ajuste a variável no servidor e reinicie o msgops-api.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>Falha ao carregar feature flags</AlertTitle>
              <AlertDescription>O endpoint público GET /feature-flags não respondeu. Verifique se o msgops-api está no ar.</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-48" />
            </div>
          ) : enabled ? (
            <HubModePreview />
          ) : (
            <MetaModePreview />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canais conectados</CardTitle>
          <CardDescription>A lista de canais ativa entra na Onda 4 (API de canais).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm italic">Nenhum canal cadastrado — a CRUD de canais será adicionada quando POST /accounts/:id/whatsapp-channels existir.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetaModePreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Conexão <strong>direto com a Meta</strong> via Embedded Signup. O administrador conecta sua própria conta Meta App + WABA. O BMS troca o <code className="bg-muted rounded px-1 text-xs">code</code> retornado pelo FB.login por um <code className="bg-muted rounded px-1 text-xs">access_token</code> e fala direto com <code className="bg-muted rounded px-1 text-xs">graph.facebook.com</code>.
      </p>
      <Button size="lg" disabled className="bg-[#1877f2] text-white hover:bg-[#1877f2]/90">
        Entrar com Facebook (Wave 7.4)
      </Button>
      <p className="text-muted-foreground text-xs">Botão fica funcional quando MetaConnectButton + FB SDK loader entrarem (Onda 7.4).</p>
    </div>
  );
}

function HubModePreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Conexão <strong>via EvoHub</strong>. O Hub provê o Meta App compartilhado e gerencia o Embedded Signup; o BMS recebe um <code className="bg-muted rounded px-1 text-xs">public_link</code> que o admin abre em outra aba e fala com a Meta via <code className="bg-muted rounded px-1 text-xs">api.evohub.ai/meta/*</code>.
      </p>
      <Button size="lg" disabled>
        Conectar via EvoHub (Wave 7.4)
      </Button>
      <p className="text-muted-foreground text-xs">Botão fica funcional quando HubConnectButton + polling de status entrarem (Onda 7.4).</p>
    </div>
  );
}
