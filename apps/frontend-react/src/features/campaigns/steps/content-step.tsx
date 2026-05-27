import { useEffect } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CampaignFormValues } from '../campaign-schema';
import type { SearchableMessage } from '../use-campaign-messages';
import MessageCard from './message-card';

interface ContentStepProps {
  form: UseFormReturn<CampaignFormValues>;
}

const MESSAGE_LABELS: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'C',
  3: 'D',
};

const CONTENT_TITLES: Record<string, string> = {
  simple: 'campaigns.contentTitleSimple',
  testAB: 'campaigns.contentTitleTestAB',
  split: 'campaigns.contentTitleSplit',
  recurring: 'campaigns.contentTitleRecurring',
};

export default function ContentStep({ form }: ContentStepProps) {
  const { t } = useTranslation();
  const campaignType = form.watch('type');
  const messageType = form.watch('messageType');
  const messages = form.watch('campaignMessage') ?? [];

  const isMultiMessage = campaignType === 'testAB' || campaignType === 'split';
  const maxMessages = isMultiMessage ? 4 : 1;

  const handleSelectMessage = (index: number, msg: SearchableMessage) => {
    // Check for duplicates
    const isDuplicate = messages.some((m, i) => i !== index && (m.id === msg.id || m.messageId === msg.id));
    if (isDuplicate) return;

    const updatedMessages = [...messages];
    updatedMessages[index] = {
      ...msg,
      messageId: msg.id,
      statistics: updatedMessages[index]?.statistics,
    };
    form.setValue('campaignMessage', updatedMessages);
  };

  const handleRemoveMessage = (index: number) => {
    const updatedMessages = messages.filter((_, i) => i !== index);
    form.setValue('campaignMessage', updatedMessages);
  };

  const handleAddMessage = () => {
    if (messages.length >= maxMessages) return;
    form.setValue('campaignMessage', [...messages, {} as never]);
  };

  // Ensure at least one empty message slot
  useEffect(() => {
    if (messages.length === 0) {
      form.setValue('campaignMessage', [{} as never]);
    }
  }, [messages.length, form]);

  return (
    <div className="space-y-4" data-testid="content-step">
      <h4 className="text-sm font-medium">
        {t((CONTENT_TITLES[campaignType] ?? 'campaigns.contentTitleSimple') as never)}
      </h4>

      {messages.map((message, index) => (
        <MessageCard
          key={index}
          index={index}
          message={message}
          messageType={messageType}
          allMessages={messages}
          onSelect={(msg) => handleSelectMessage(index, msg)}
          onRemove={() => handleRemoveMessage(index)}
          label={isMultiMessage ? `${t('campaigns.messageSelected')} ${MESSAGE_LABELS[index] ?? index + 1}` : undefined}
        />
      ))}

      {/* Add message button */}
      {messages.length < maxMessages && (isMultiMessage || messages.length === 0) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddMessage}
          className="gap-2"
          data-testid="add-message-btn"
        >
          <Plus className="h-4 w-4" />
          {t('campaigns.addMessage')}
        </Button>
      )}

      {/* Warning for TestAB/Split with < 2 messages */}
      {isMultiMessage && messages.filter((m) => m.id || m.messageId).length < 2 && (
        <Alert variant="destructive">
          <AlertDescription>{t('campaigns.minTwoMessages')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
