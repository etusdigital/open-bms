import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { setupGateway } from '@/features/setup/setup-gateway';
import { Step1Admin } from '@/features/setup/steps/Step1Admin';
import { Step2Smtp } from '@/features/setup/steps/Step2Smtp';
import { Step3Domain } from '@/features/setup/steps/Step3Domain';
import { Step4Sendgrid } from '@/features/setup/steps/Step4Sendgrid';
import { Step5Pool } from '@/features/setup/steps/Step5Pool';
import { Step6HealthCheck } from '@/features/setup/steps/Step6HealthCheck';
import { LoadingScreen } from '@/components/loading-screen';

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});

const STEPS = [
  { num: 1, label: 'Admin' },
  { num: 2, label: 'SMTP' },
  { num: 3, label: 'Domínio' },
  { num: 4, label: 'SendGrid' },
  { num: 5, label: 'IP Pool' },
  { num: 6, label: 'Health' },
] as const;

const STEP_TITLES: Record<number, string> = {
  1: 'Criar conta de administrador',
  2: 'Configurar servidor SMTP',
  3: 'URL base da plataforma',
  4: 'Provedor de envio em massa (SendGrid)',
  5: 'IP Pool e primeira conta',
  6: 'Verificação de saúde dos serviços',
};

function SetupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [baseUrl, setBaseUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setupGateway
      .getStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.configured) {
          navigate({ to: '/', replace: true });
          return;
        }
        setCurrentStep(status.currentStep || 1);
        setBaseUrl(status.baseUrl);
      })
      .catch(() => {
        if (!cancelled) setCurrentStep(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function advance() {
    setCurrentStep((s) => Math.min(s + 1, 6));
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
          {currentStep === 2 && <Step2Smtp onComplete={advance} />}
          {currentStep === 3 && <Step3Domain onComplete={advance} />}
          {currentStep === 4 && <Step4Sendgrid onComplete={advance} baseUrl={baseUrl} />}
          {currentStep === 5 && <Step5Pool onComplete={advance} />}
          {currentStep === 6 && <Step6HealthCheck onComplete={finish} />}
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
