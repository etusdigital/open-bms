import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, UserMinus, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useBulkAddTags, useBulkRemoveTags, useBulkUnsubscribe, useTagOptions } from '../use-contact-tags';
import { useContactExport } from '../use-contact-export';
import { BulkTagPicker } from './bulk-tag-picker';

interface BulkActionsBarProps {
  selectedIds: number[];
  selectedEmails: string[];
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedIds, selectedEmails, onClearSelection }: BulkActionsBarProps) {
  const { t } = useTranslation();
  const count = selectedIds.length;

  const addTags = useBulkAddTags();
  const removeTags = useBulkRemoveTags();
  const unsubscribe = useBulkUnsubscribe();
  const exportContacts = useContactExport();

  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);
  const [addTagsOpen, setAddTagsOpen] = useState(false);
  const [removeTagsOpen, setRemoveTagsOpen] = useState(false);

  // Lazy-load tags only when a tag picker opens
  const [tagsEnabled, setTagsEnabled] = useState(false);
  const tagsQuery = useTagOptions(tagsEnabled);

  const handleAddTagsOpen = (open: boolean) => {
    setAddTagsOpen(open);
    if (open && !tagsEnabled) setTagsEnabled(true);
  };

  const handleRemoveTagsOpen = (open: boolean) => {
    setRemoveTagsOpen(open);
    if (open && !tagsEnabled) setTagsEnabled(true);
  };

  const handleAddTags = (tagIds: number[]) => {
    addTags.mutate(
      { contactIds: selectedIds, tagIds },
      {
        onSuccess: () => {
          setAddTagsOpen(false);
          onClearSelection();
        },
      },
    );
  };

  const handleRemoveTags = (tagIds: number[]) => {
    removeTags.mutate(
      { contactIds: selectedIds, tagIds },
      {
        onSuccess: () => {
          setRemoveTagsOpen(false);
          onClearSelection();
        },
      },
    );
  };

  const handleUnsubscribe = () => {
    unsubscribe.mutate(
      { emails: selectedEmails },
      {
        onSuccess: () => {
          setShowUnsubscribeConfirm(false);
          onClearSelection();
        },
      },
    );
  };

  const handleExport = () => {
    exportContacts.mutate(selectedIds);
  };

  const isPending = addTags.isPending || removeTags.isPending || unsubscribe.isPending || exportContacts.isPending;

  if (count === 0) return null;

  return (
    <>
      <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
        <span className="text-sm font-medium">{t('contacts.bulkActionsSelected', { count })}</span>
        <Separator orientation="vertical" className="h-5" />

        <BulkTagPicker
          open={addTagsOpen}
          onOpenChange={handleAddTagsOpen}
          options={tagsQuery.data ?? []}
          isLoading={tagsQuery.isLoading}
          onApply={handleAddTags}
          isPending={addTags.isPending}
          label={t('contacts.bulkAddTags')}
          icon={<Tag className="mr-1 h-3.5 w-3.5" />}
        />

        <BulkTagPicker
          open={removeTagsOpen}
          onOpenChange={handleRemoveTagsOpen}
          options={tagsQuery.data ?? []}
          isLoading={tagsQuery.isLoading}
          onApply={handleRemoveTags}
          isPending={removeTags.isPending}
          label={t('contacts.bulkRemoveTags')}
          icon={<Tag className="mr-1 h-3.5 w-3.5" />}
        />

        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setShowUnsubscribeConfirm(true)}
          disabled={isPending}
        >
          <UserMinus className="mr-1 h-3.5 w-3.5" />
          {t('contacts.bulkUnsubscribe')}
        </Button>

        <Button variant="outline" size="sm" className="text-xs" onClick={handleExport} disabled={isPending}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {t('contacts.export')}
        </Button>

        <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={onClearSelection} disabled={isPending}>
          <X className="mr-1 h-3 w-3" />
          {t('contacts.clearSelection')}
        </Button>
      </div>

      <ConfirmDialog
        open={showUnsubscribeConfirm}
        onOpenChange={setShowUnsubscribeConfirm}
        title={t('contacts.bulkUnsubscribe')}
        description={t('contacts.bulkUnsubscribeConfirm', { count })}
        onConfirm={handleUnsubscribe}
        loading={unsubscribe.isPending}
      />
    </>
  );
}
