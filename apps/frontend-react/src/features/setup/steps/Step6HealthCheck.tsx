import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setupGateway } from '@/features/setup/setup-gateway';
import type { HealthCheckResult } from '@/features/setup/setup.types';

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

// Mirrors the Vue 3 wizard's 4-second debounce on "Verificar novamente"
// to prevent hammering /setup/health-check (backend rate-limits anyway).
const RETRY_COOLDOWN_MS = 4000;

const SERVICES = [
  { key: 'postgres', label: 'PostgreSQL' },
  { key: 'redis', label: 'Redis' },
  { key: 'clickhouse', label: 'ClickHouse' },
  { key: 'rabbitmq', label: 'RabbitMQ' },
  { key: 's3', label: 'S3' },
] as const;

type ServiceKey = (typeof SERVICES)[number]['key'];

export function Step6HealthCheck({ onComplete, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [results, setResults] = useState<HealthCheckResult | null>(null);
  const [retryOnCooldown, setRetryOnCooldown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runCheck() {
    if (loading) return;
    setLoading(true);
    setRetryOnCooldown(true);
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => setRetryOnCooldown(false), RETRY_COOLDOWN_MS);
    try {
      const res = await setupGateway.healthCheck();
      setResults(res);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao verificar serviços.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runCheck();
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SMTP probe is removed from the UI but the backend still includes it in the
  // response; recompute allOk against the services we actually display so the
  // "fail confirm" dialog doesn't trigger because of an irrelevant probe.
  const visibleAllOk = results
    ? SERVICES.every((s) => results[s.key as ServiceKey].ok)
    : false;

  function handleComplete() {
    if (visibleAllOk) {
      doComplete();
    } else {
      setShowConfirm(true);
    }
  }

  async function doComplete() {
    setShowConfirm(false);
    setCompleting(true);
    try {
      const data = visibleAllOk
        ? {}
        : { skipReason: 'Administrador optou por concluir com serviços com falha.' };
      await setupGateway.advanceStep({ step: 6, data });
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao concluir configuração.';
      toast.error(msg);
    } finally {
      setCompleting(false);
    }
  }

  const failingServices = results
    ? SERVICES.filter((s) => !results[s.key as ServiceKey].ok).map((s) => ({
        ...s,
        error: results[s.key as ServiceKey].error ?? '',
      }))
    : [];

  return (
    <div>
      {loading && !results && (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-r-transparent" />
          <span>Verificando serviços...</span>
        </div>
      )}

      {results && (
        <>
          <div className="mb-6 space-y-2">
            {SERVICES.map((service) => {
              const r = results[service.key as ServiceKey];
              return (
                <div
                  key={service.key}
                  className={
                    'flex items-center justify-between rounded-lg border px-4 py-3 ' +
                    (r.ok
                      ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10'
                      : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10')
                  }
                >
                  <span className="text-foreground text-sm font-medium">{service.label}</span>
                  <div className="flex items-center gap-2">
                    {r.ok ? (
                      <>
                        <span className="text-muted-foreground text-xs">{r.latencyMs}ms</span>
                        <span className="font-bold text-green-600">✓</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="max-w-[180px] truncate text-xs text-red-600"
                          title={r.error}
                        >
                          {r.error}
                        </span>
                        <span className="font-bold text-red-600">✗</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button type="button" variant="ghost" disabled={loading || completing} onClick={onBack}>
                  Voltar
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={loading || completing || retryOnCooldown}
                onClick={runCheck}
              >
                Verificar novamente
              </Button>
            </div>
            <Button type="button" disabled={completing || loading} onClick={handleComplete}>
              {completing ? 'Concluindo...' : 'Concluir'}
            </Button>
          </div>
        </>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <h3 className="text-foreground mb-2 text-base font-semibold">Serviços com falha</h3>
            <p className="text-muted-foreground mb-3 text-sm">
              Os serviços abaixo não responderam corretamente. A plataforma pode não funcionar como esperado até que sejam corrigidos:
            </p>
            <ul className="mb-4 space-y-1">
              {failingServices.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm text-red-600">
                  <span className="font-bold">✗</span>
                  {s.label}
                  {s.error && <span className="truncate text-xs text-red-400" title={s.error}> — {s.error}</span>}
                </li>
              ))}
            </ul>
            <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10">
              Deseja concluir mesmo assim? Você poderá corrigir as configurações após o primeiro acesso.
            </p>
            <div className="flex justify-between gap-3">
              <Button type="button" variant="secondary" disabled={completing} onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={completing} onClick={doComplete}>
                {completing ? 'Concluindo...' : 'Concluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
