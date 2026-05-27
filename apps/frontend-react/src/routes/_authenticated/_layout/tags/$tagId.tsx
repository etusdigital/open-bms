import { createFileRoute } from '@tanstack/react-router';
import { TagFormPage } from '@/features/tags/tag-form-page';

export const Route = createFileRoute('/_authenticated/_layout/tags/$tagId')({
  component: TagEditRoute,
});

function TagEditRoute() {
  const { tagId } = Route.useParams();
  return <TagFormPage tagId={Number(tagId)} />;
}
