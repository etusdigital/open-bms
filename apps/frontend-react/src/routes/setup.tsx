import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { setupGateway } from '@/features/setup/setup-gateway';
import { Step1Admin } from '@/features/setup/steps/Step1Admin';
import { Step2EnterpriseImport } from '@/features/setup/steps/Step2EnterpriseImport';
import { Step3Domain } from '@/features/setup/steps/Step3Domain';
import { Step4GeoIp } from '@/features/setup/steps/Step4GeoIp';
import { Step5S3 } from '@/features/setup/steps/Step5S3';
import { Step6HealthCheck } from '@/features/setup/steps/Step6HealthCheck';
import { LoadingScreen } from '@/components/loading-screen';

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});

const STEPS = [
  { num: 1, label: 'Admin' },
  { num: 2, label: 'Enterprise' },
  { num: 3, label: 'Domínio' },
  { num: 4, label: 'GeoIP' },
  { num: 5, label: 'S3' },
  { num: 6, label: 'Health' },
] as const;

const STEP_TITLES: Record<number, string> = {
  1: 'Criar conta de administrador',
  2: 'Importar do BMS Enterprise (opcional)',
  3: 'URL base da plataforma',
  4: 'Enriquecimento de IP (GeoIP)',
  5: 'Armazenamento de arquivos (S3)',
  6: 'Verificação de saúde dos serviços',
};

// Backend keeps 6 internal steps (1=Admin, 2=SMTP, 3=Domain, 4=SendGrid,
// 5=Pool, 6=Health). The UI has up to 6 visible steps: Admin / Enterprise
// import / Domain / GeoIP / S3 / Health. Enterprise/GeoIP/S3 are UI-only.
//
// The Enterprise step (UI 2) has no backend step, so resume can't derive it
// from backend.currentStep. Mapping:
//  - admin not created yet (backend step <=1)               → UI 1
//  - admin created, Enterprise enabled and not yet done     → UI 2
//  - wizard complete                                        → UI 6
//  - otherwise (Enterprise done/off, mid-flow)              → UI 3 (Domain)
function resolveUiStep(status: {
  currentStep?: number;
  enterpriseImportEnabled?: boolean;
  enterpriseImportDone?: boolean;
}): number {
  const backendStep = status.currentStep ?? 1;
  if (backendStep <= 1) return 1;
  if (status.enterpriseImportEnabled && !status.enterpriseImportDone) return 2;
  if (backendStep >= 6) return 6;
  return 3;
}

function SetupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [enterpriseEnabled, setEnterpriseEnabled] = useState<boolean>(false);
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
        setEnterpriseEnabled(!!status.enterpriseImportEnabled);
        setCurrentStep(resolveUiStep(status));
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

  // When Enterprise is disabled, Step 2 doesn't exist — skip from 1→3.
  function advance() {
    setCurrentStep((s) => {
      const next = s + 1;
      if (next === 2 && !enterpriseEnabled) return 3;
      return Math.min(next, 6);
    });
  }

  function back() {
    setCurrentStep((s) => {
      const prev = s - 1;
      if (prev === 2 && !enterpriseEnabled) return 1;
      return Math.max(prev, 1);
    });
  }

  function finish() {
    navigate({ to: '/', replace: true });
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-wider">Configuração inicial da plataforma</h1>
          <p className="text-muted-foreground mt-1 text-sm">Complete os passos abaixo para começar a usar o sistema.</p>
        </div>

        <StepIndicator currentStep={currentStep} enterpriseEnabled={enterpriseEnabled} />

        <div className="bg-card border-border rounded-2xl border px-8 pt-6 pb-8 shadow-md">
          <h2 className="text-foreground mb-5 text-base font-semibold tracking-wide">{STEP_TITLES[currentStep]}</h2>

          {currentStep === 1 && <Step1Admin onComplete={advance} />}
          {currentStep === 2 && enterpriseEnabled && <Step2EnterpriseImport onComplete={advance} onBack={back} />}
          {currentStep === 3 && <Step3Domain onComplete={advance} onBack={back} />}
          {currentStep === 4 && <Step4GeoIp onComplete={advance} onBack={back} />}
          {currentStep === 5 && <Step5S3 onComplete={advance} onBack={back} />}
          {currentStep === 6 && <Step6HealthCheck onComplete={finish} onBack={back} />}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep, enterpriseEnabled }: { currentStep: number; enterpriseEnabled: boolean }) {
  // Without the feature, the Enterprise step (num 2) is hidden from the indicator.
  const steps = enterpriseEnabled ? STEPS : STEPS.filter((s) => s.num !== 2);
  return (
    <div className="mb-8 flex items-center justify-center">
      {steps.map((step, i) => (
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
          {i < steps.length - 1 && (
            <div
              className={'mx-2 mb-5 h-px w-10 flex-shrink-0 ' + (step.num < currentStep ? 'bg-primary' : 'bg-muted')}
            />
          )}
        </div>
      ))}
    </div>
  );
}
