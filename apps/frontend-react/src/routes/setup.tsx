import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { setupGateway } from '@/features/setup/setup-gateway';
import { Step1Admin } from '@/features/setup/steps/Step1Admin';
import { Step3Domain } from '@/features/setup/steps/Step3Domain';
import { Step5Pool } from '@/features/setup/steps/Step5Pool';
import { Step6HealthCheck } from '@/features/setup/steps/Step6HealthCheck';
import { LoadingScreen } from '@/components/loading-screen';

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});

const STEPS = [
  { num: 1, label: 'Admin' },
  { num: 2, label: 'Domínio' },
  { num: 3, label: 'IP Pool' },
  { num: 4, label: 'Health' },
] as const;

const STEP_TITLES: Record<number, string> = {
  1: 'Criar conta de administrador',
  2: 'URL base da plataforma',
  3: 'IP Pool e primeira conta',
  4: 'Verificação de saúde dos serviços',
};

// The backend wizard keeps 6 internal steps (1=Admin, 2=SMTP, 3=Domain,
// 4=SendGrid, 5=Pool, 6=Health) for compatibility with existing instances.
// SMTP (2) and SendGrid (4) are auto-skipped by the UI; the visible flow is
// 4 steps. This map collapses backend currentStep into the visible slot.
const UI_FROM_BACKEND: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 4 };

function SetupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setupGateway
      .getStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.configured) {
          // Keep loading=true so the setup form never paints during the
          // redirect — otherwise the wizard flashes for a frame before
          // navigation resolves and a fast user could submit the admin
          // form against a wizard that's already complete.
          navigate({ to: '/', replace: true });
          return;
        }
        const ui = UI_FROM_BACKEND[status.currentStep ?? 1] ?? 1;
        setCurrentStep(ui);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentStep(1);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function advance() {
    setCurrentStep((s) => Math.min(s + 1, 4));
  }

  function back() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function finish() {
    navigate({ to: '/', replace: true });
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-wider">
            Configuração inicial da plataforma
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Complete os passos abaixo para começar a usar o sistema.
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        <div className="bg-card border-border rounded-2xl border px-8 pt-6 pb-8 shadow-md">
          <h2 className="text-foreground mb-5 text-base font-semibold tracking-wide">
            {STEP_TITLES[currentStep]}
          </h2>

          {currentStep === 1 && <Step1Admin onComplete={advance} />}
          {currentStep === 2 && <Step3Domain onComplete={advance} onBack={back} />}
          {currentStep === 3 && <Step5Pool onComplete={advance} onBack={back} />}
          {currentStep === 4 && <Step6HealthCheck onComplete={finish} onBack={back} />}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {STEPS.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ' +
                (step.num < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step.num === currentStep
                    ? 'bg-primary text-primary-foreground ring-primary ring-2 ring-offset-2'
                    : 'bg-muted text-muted-foreground border-border border')
              }
            >
              {step.num < currentStep ? <Check className="h-4 w-4" /> : <span>{step.num}</span>}
            </div>
            <span
              className={
                'text-[10px] font-medium whitespace-nowrap ' +
                (step.num === currentStep ? 'text-primary' : 'text-muted-foreground')
              }
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={
                'mx-2 mb-5 h-px w-10 flex-shrink-0 ' +
                (step.num < currentStep ? 'bg-primary' : 'bg-muted')
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
