import { createFileRoute } from '@tanstack/react-router';
import { TagFormPage } from '@/features/tags/tag-form-page';

export const Route = createFileRoute('/_authenticated/_layout/tags/create')({
  component: TagCreateRoute,
});

function TagCreateRoute() {
  return <TagFormPage />;
}
