import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Search } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import { formatDateTime } from '@/lib/datetime';
import { useAppStore } from '@/stores/app-store';
import type { CustomFieldValue } from '../types';

interface ContactCustomFieldsCardProps {
  contactId: number;
  accountId: number;
  customFields: CustomFieldValue[];
}

export const ContactCustomFieldsCard = memo(function ContactCustomFieldsCard({
  contactId,
  accountId,
  customFields,
}: ContactCustomFieldsCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const auth = useAppStore((s) => s.auth);
  const timezone = auth.status === 'authenticated' ? auth.timezone : undefined;
  const fmtOpts = useMemo(
    () => ({ timezone, locale: i18n.language || navigator.language }),
    [timezone],
  );
  const [search, setSearch] = useState('');
  const [editField, setEditField] = useState<CustomFieldValue | null>(null);
  const [editValue, setEditValue] = useState('');

  const filtered = useMemo(() => {
    if (!search) return customFields;
    const lower = search.toLowerCase();
    return customFields.filter((f) => f.title.toLowerCase().includes(lower));
  }, [customFields, search]);

  const updateMutation = useMutation({
    mutationFn: async (params: { customFieldId: number; value: string; oldValue: string }) => {
      const { data } = await apiClient.put('/contacts/custom-fields/edit', {
        accountId,
        contactId,
        customFieldId: params.customFieldId,
        value: params.value,
        oldValue: params.oldValue,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('contacts.customFieldSaved'));
      setEditField(null);
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.customFieldError'));
    },
  });

  const handleEdit = (field: CustomFieldValue) => {
    setEditField(field);
    setEditValue(field.value ?? '');
  };

  const handleSave = () => {
    if (!editField) return;
    updateMutation.mutate({
      customFieldId: editField.customFieldId,
      value: editValue,
      oldValue: editField.value,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('contacts.customFields')}</CardTitle>
        </CardHeader>
        <CardContent>
          {customFields.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('contacts.noCustomFields')}</p>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search', 'Buscar...')}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                {filtered.map((field) => (
                  <div
                    key={field.customFieldId}
                    className="border-muted flex items-center justify-between border-b pb-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">{field.title}</p>
                      <p className="truncate">{field.value || '—'}</p>
                      {field.updatedAt && (
                        <p className="text-muted-foreground text-[10px]">{formatDateTime(field.updatedAt, fmtOpts)}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(field)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editField !== null}
        onOpenChange={(open) => {
          if (!open) setEditField(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('contacts.editCustomField')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">{editField?.title}</Label>
              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditField(null)}>
              {t('common.cancel', 'Cancelar')}
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {t('common.save', 'Salvar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
