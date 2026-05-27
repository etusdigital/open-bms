import { createFileRoute } from '@tanstack/react-router';
import WhatsAppConnectPage from '@/features/whatsapp/connect-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/whatsapp/connect')({
  component: WhatsAppConnectPage,
});
