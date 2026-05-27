import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { HttpValuePicker } from './http-value-picker';
import type { HttpRequestNodeData, HttpKeyValueItem } from '../types';

const HTTP_METHODS = [
  { value: 'get', label: 'GET' },
  { value: 'post', label: 'POST' },
  { value: 'put', label: 'PUT' },
  { value: 'delete', label: 'DELETE' },
];

interface HttpRequestConfigProps {
  data: HttpRequestNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}

export function HttpRequestConfig({ data, onSave, onClose }: HttpRequestConfigProps) {
  const { t } = useTranslation();
  const [operation, setOperation] = useState(data.settings.operation ?? 'get');
  const [url, setUrl] = useState(data.settings.url ?? '');
  const [headers, setHeaders] = useState<HttpKeyValueItem[]>(data.settings.headers ?? []);
  const [body, setBody] = useState<HttpKeyValueItem[]>(data.settings.body ?? []);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; data: unknown } | null>(null);

  const showBody = operation === 'post' || operation === 'put';

  const persist = (
    overrides?: Partial<{
      operation: string;
      url: string;
      headers: HttpKeyValueItem[];
      body: HttpKeyValueItem[];
    }>,
  ) => {
    const settings = {
      operation: overrides?.operation ?? operation,
      url: overrides?.url ?? url,
      headers: overrides?.headers ?? headers,
      body: overrides?.body ?? body,
      queryString: '',
      newTry: false,
      quantityTry: 0,
    };
    onSave(settings);
  };

  // Header management
  const addHeader = () => {
    const updated = [...headers, { key: '', value: { id: '', description: '', type: 'custom' as const } }];
    setHeaders(updated);
    persist({ headers: updated });
  };

  const removeHeader = (index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    setHeaders(updated);
    persist({ headers: updated });
  };

  const updateHeaderKey = (index: number, key: string) => {
    const updated = headers.map((h, i) => (i === index ? { ...h, key } : h));
    setHeaders(updated);
    persist({ headers: updated });
  };

  const updateHeaderValue = (index: number, value: HttpKeyValueItem['value']) => {
    const updated = headers.map((h, i) => (i === index ? { ...h, value } : h));
    setHeaders(updated);
    persist({ headers: updated });
  };

  // Body management
  const addBodyItem = () => {
    const updated = [...body, { key: '', value: { id: '', description: '', type: 'custom' as const } }];
    setBody(updated);
    persist({ body: updated });
  };

  const removeBodyItem = (index: number) => {
    const updated = body.filter((_, i) => i !== index);
    setBody(updated);
    persist({ body: updated });
  };

  const updateBodyKey = (index: number, key: string) => {
    const updated = body.map((b, i) => (i === index ? { ...b, key } : b));
    setBody(updated);
    persist({ body: updated });
  };

  const updateBodyValue = (index: number, value: HttpKeyValueItem['value']) => {
    const updated = body.map((b, i) => (i === index ? { ...b, value } : b));
    setBody(updated);
    persist({ body: updated });
  };

  // Test request
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: result } = await apiClient.post('/automations/http-request-test', {
        operation,
        url,
        headers,
        body,
        queryString: '',
        newTry: false,
        quantityTry: 0,
      });
      setTestResult(result);
      if (result.status < 300) {
        toast.success(`${t('automations.editor.http.testSuccess')} (${result.status})`);
      } else {
        toast.error(`${t('automations.editor.http.testError')} (${result.status})`);
      }
    } catch (err: any) {
      toast.error(err.message ?? t('automations.editor.http.testError'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Method + URL */}
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('automations.editor.http.method')}</Label>
          <Select
            value={operation}
            onValueChange={(v) => {
              setOperation(v as any);
              persist({ operation: v });
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">URL</Label>
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              persist({ url: e.target.value });
            }}
            placeholder="https://example.com/webhook"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">{t('automations.editor.http.headers')}</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={addHeader}>
            <Plus className="h-3 w-3" /> {t('common.add')}
          </Button>
        </div>
        {headers.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="h-8 flex-1 text-xs"
              placeholder="Key"
              value={item.key}
              onChange={(e) => updateHeaderKey(i, e.target.value)}
            />
            <HttpValuePicker value={item.value} onChange={(v) => updateHeaderValue(i, v)} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
              onClick={() => removeHeader(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Body (POST/PUT only) */}
      {showBody && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">{t('automations.editor.http.body')}</Label>
            <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={addBodyItem}>
              <Plus className="h-3 w-3" /> {t('common.add')}
            </Button>
          </div>
          {body.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="h-8 flex-1 text-xs"
                placeholder="Key"
                value={item.key}
                onChange={(e) => updateBodyKey(i, e.target.value)}
              />
              <HttpValuePicker value={item.value} onChange={(v) => updateBodyValue(i, v)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
                onClick={() => removeBodyItem(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Test button */}
      <div className="border-t pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleTest}
          disabled={testing || !url}
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {testResult ? t('automations.editor.http.retest') : t('automations.editor.http.test')}
        </Button>

        {testResult && (
          <Collapsible defaultOpen className="mt-2">
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium">
              <Badge variant={testResult.status < 300 ? 'default' : 'destructive'} className="text-[10px]">
                {testResult.status}
              </Badge>
              {t('automations.editor.http.response')}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="bg-muted mt-1 max-h-[200px] overflow-auto rounded p-2 text-[10px]">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}
