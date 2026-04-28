import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: { label: string }[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between pb-6" data-testid="step-indicator">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={index} className="flex flex-1 flex-col">
            <div className="flex w-full items-center">
              {index > 0 && <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />}
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-primary text-primary border-2'
                        : 'border-muted text-muted-foreground border-2'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`absolute top-full mt-1 text-xs whitespace-nowrap ${
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
