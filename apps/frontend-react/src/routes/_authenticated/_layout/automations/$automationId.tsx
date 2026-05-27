import { createFileRoute } from '@tanstack/react-router';
import AutomationFormPage from '@/features/automations/automation-form-page';

export const Route = createFileRoute('/_authenticated/_layout/automations/$automationId')({
  component: () => {
    const { automationId } = Route.useParams();
    return <AutomationFormPage automationId={Number(automationId)} />;
  },
});
