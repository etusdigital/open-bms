import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { useAccountId } from '../use-settings';
import { webPushGateway } from './web-push-gateway';
import {
  type WebPushSettings,
  type PushStyle,
  type PushTemplateName,
  createDefaultWebPushSettings,
  regenerate,
  applyTemplate,
  buildShowScript,
  buildPushHtml,
} from './web-push-template';

// Enterprise-style web-push opt-in builder (ported from PushConfig.vue). The
// editor binds to pushStyle / pushMobileStyle; on every change we regenerate the
// html / mobileHtml / scriptToRun the runtime actually reads. Single-project:
// NO Firebase/VAPID here (platform-level, super-admin FCM tab).
export function WebPushSection() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can('account:settings_update');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'web-push-integration', accountId],
    queryFn: () => webPushGateway.getIntegration(accountId),
    enabled: accountId > 0,
  });

  const [s, setS] = useState<WebPushSettings>(() => createDefaultWebPushSettings());
  const [device, setDevice] = useState<0 | 1>(0); // 0 = desktop, 1 = mobile
  // Snippet-driving configs (persisted as account configs default_domain +
  // webpush_cookies_to_search). Edited here so the generated snippet carries
  // cookieDomain + cookiesToSearch — the contact-dedupe link with the LP.
  const [defaultDomain, setDefaultDomain] = useState('');
  const [cookiesToSearch, setCookiesToSearch] = useState('');

  useEffect(() => {
    if (data?.settings && Object.keys(data.settings).length > 1) {
      // Merge stored settings onto fresh defaults so missing generated fields are
      // backfilled (older rows may lack pushStyle/scriptToRun), then regenerate.
      const base = createDefaultWebPushSettings();
      setS(regenerate({ ...base, ...(data.settings as WebPushSettings) }));
    }
    if (data) {
      setDefaultDomain(data.defaultDomain ?? '');
      setCookiesToSearch((data.cookiesToSearch ?? []).join(', '));
    }
  }, [data]);

  // The style object currently being edited (desktop vs mobile tab).
  const sameTemplate = s.isMobileSameTemplate;
  const editingMobile = device === 1 && !sameTemplate;
  const style = editingMobile ? s.pushMobileStyle : s.pushStyle;

  // Update the active style object and regenerate the contract.
  function patchStyle(mut: (st: PushStyle) => void) {
    setS((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as WebPushSettings;
      const target = editingMobile ? next.pushMobileStyle : next.pushStyle;
      mut(target);
      return regenerate(next);
    });
  }
  function patchProp(section: keyof PushStyle, name: string, value: string) {
    patchStyle((st) => {
      (st[section] as Record<string, string>)[name] = value;
    });
  }
  function patchText(name: keyof PushStyle, value: string) {
    patchStyle((st) => {
      (st as Record<string, unknown>)[name] = value;
    });
  }

  function changeTemplate(tpl: PushTemplateName) {
    setS((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as WebPushSettings;
      if (editingMobile) {
        next.pushMobileStyle = applyTemplate(next.pushMobileStyle, tpl);
        next.mobileTemplate = tpl;
      } else {
        next.pushStyle = applyTemplate(next.pushStyle, tpl);
        next.template = tpl;
      }
      return regenerate(next);
    });
  }

  function changeTrigger(trigger: 'access' | 'percentScroll' | 'inactive', value: number) {
    setS((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as WebPushSettings;
      const script = buildShowScript(trigger, value);
      if (editingMobile) {
        next.mobileScriptType = trigger;
        next.mobileScriptShowPush = script;
      } else {
        next.scriptType = trigger;
        next.scriptShowPush = script;
      }
      return regenerate(next);
    });
  }

  function setUrls(kind: 'urlFilterShow' | 'urlFilterHide', urls: string[]) {
    setS((prev) => regenerate({ ...prev, [kind]: urls }));
  }

  const save = useMutation({
    mutationFn: () =>
      webPushGateway.saveSettings(accountId, {
        ...regenerate(s),
        defaultDomain: defaultDomain.trim(),
        cookiesToSearch: cookiesToSearch
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'web-push-integration', accountId] });
      toast.success(t('settings.webPushSaved'));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('settings.webPushSaveError')),
  });

  const regen = useMutation({
    mutationFn: () => webPushGateway.regenerateSw(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'web-push-integration', accountId] });
      toast.success(t('settings.webPushSwRegenerated'));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('settings.webPushSwRegenerateError')),
  });

  function copySnippet() {
    if (!data?.snippet) return;
    navigator.clipboard.writeText(data.snippet).then(
      () => toast.success(t('common.copied')),
      () => toast.error(t('settings.webPushCopyError')),
    );
  }

  function downloadSw() {
    if (!data?.serviceWorkerUrl) return;
    const content = `// BMS Web-Push service worker — host this file at your site root as /sw.js\nimportScripts("${data.serviceWorkerUrl}");\n`;
    const blob = new Blob([content], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sw.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const isNative = (editingMobile ? s.mobileTemplate : s.template) === 'native';
  const triggerType = editingMobile ? s.mobileScriptType : s.scriptType;
  const previewHtml = editingMobile ? buildPushHtml(s.pushMobileStyle) : buildPushHtml(s.pushStyle);

  if (isLoading) return <p className="text-muted-foreground mt-8 text-sm">{t('common.loading')}</p>;

  return (
    <div className="mt-4 flex flex-col gap-8">
      {/* 1. UTM params */}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">{t('settings.webPushUtmTitle')}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Source"><Input value={s.utmSource} onChange={(e) => setS((p) => ({ ...p, utmSource: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label="Medium"><Input value={s.utmMedium} onChange={(e) => setS((p) => ({ ...p, utmMedium: e.target.value }))} disabled={!canEdit} /></Field>
          <Field label={t('settings.webPushUtmName')}><Input value={s.utmName} onChange={(e) => setS((p) => ({ ...p, utmName: e.target.value }))} disabled={!canEdit} /></Field>
        </div>
      </section>

      {/* 2. Integration — Download SW + snippet */}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">{t('settings.webPushIntegrationTitle')}</h3>
        <p className="text-muted-foreground text-sm">{t('settings.webPushIntegrationHelp')}</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">1. {t('settings.webPushStep1')}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={downloadSw} disabled={!data?.serviceWorkerUrl}>{t('settings.downloadSw')}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => regen.mutate()} disabled={!canEdit || regen.isPending}>{regen.isPending ? '...' : t('settings.regenerateSw')}</Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm">2. {t('settings.webPushStep2')}</span>
            <Button type="button" variant="outline" size="sm" onClick={copySnippet}>{t('common.copy')}</Button>
          </div>
          <Textarea readOnly rows={12} className="font-mono text-xs" value={data?.snippet ?? ''} />
        </div>

        {/* Snippet-driving configs: cookie domain + cookies to search. Editing
            these regenerates cookieDomain + cookiesToSearch in the snippet above
            (after Save). This is the contact-dedupe link with the landing page. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('settings.webPushCookieDomain')}>
            <Input
              value={defaultDomain}
              onChange={(e) => setDefaultDomain(e.target.value)}
              disabled={!canEdit}
              placeholder="https://seusite.com.br"
            />
            <span className="text-muted-foreground text-xs">{t('settings.webPushCookieDomainHelp')}</span>
          </Field>
          <Field label={t('settings.webPushCookiesToSearch')}>
            <Input
              value={cookiesToSearch}
              onChange={(e) => setCookiesToSearch(e.target.value)}
              disabled={!canEdit}
              placeholder="registeredLead, _quiz_maker_quiz"
            />
            <span className="text-muted-foreground text-xs">{t('settings.webPushCookiesToSearchHelp')}</span>
          </Field>
        </div>
      </section>

      {/* 3. Opt-in popup builder */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('settings.optinTitle')}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.isActive} onChange={(e) => setS((p) => ({ ...p, isActive: e.target.checked }))} disabled={!canEdit} />
            {t('settings.webPushActive')}
          </label>
        </div>

        {/* device tabs + same-template toggle */}
        <div className="flex items-center gap-2">
          {(['Desktop', 'Mobile'] as const).map((lbl, i) => (
            <button key={lbl} type="button" onClick={() => setDevice(i as 0 | 1)} className={`rounded-md px-3 py-1 text-sm ${device === i ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}>{lbl}</button>
          ))}
          {device === 1 && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.isMobileSameTemplate} onChange={(e) => setS((p) => regenerate({ ...p, isMobileSameTemplate: e.target.checked }))} disabled={!canEdit} />
              {t('settings.webPushMobileSameTemplate')}
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          {/* preview — render the ACTUAL generated html (position:absolute so it sits in the box) */}
          <div className="relative min-h-[360px] overflow-hidden rounded-md bg-gray-200 p-6">
            <div className="pointer-events-none absolute inset-6 flex flex-col gap-3 opacity-50">
              <div className="h-20 rounded bg-gray-300" />
              <div className="flex gap-3">
                <div className="h-40 w-1/3 rounded bg-gray-300" />
                <div className="flex flex-1 flex-col gap-2"><div className="h-8 rounded bg-gray-300" /><div className="h-8 rounded bg-gray-300" /></div>
              </div>
            </div>
            {device === 1 && !sameTemplate ? (
              <div className="relative z-10 mx-auto w-[320px] rounded-[28px] bg-gray-600 p-3 pt-6">
                <div className="relative min-h-[480px] overflow-hidden rounded-[18px] bg-gray-100" dangerouslySetInnerHTML={{ __html: previewHtml.replace('position:fixed', 'position:absolute') }} />
              </div>
            ) : (
              <div className="relative z-10" dangerouslySetInnerHTML={{ __html: previewHtml.replace('position:fixed', 'position:absolute') }} />
            )}
          </div>

          {/* controls */}
          <div className="flex max-h-[560px] flex-col gap-4 overflow-y-auto pr-1">
            {/* template */}
            <Field label={t('settings.webPushTemplate')}>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={editingMobile ? s.mobileTemplate : s.template} onChange={(e) => changeTemplate(e.target.value as PushTemplateName)} disabled={!canEdit}>
                <option value="default">{t('settings.webPushTplDefault')}</option>
                <option value="bar">{t('settings.webPushTplBar')}</option>
                <option value="native">{t('settings.webPushTplNative')}</option>
              </select>
            </Field>

            {isNative ? (
              <p className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">{t('settings.webPushNativeAlert')}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('settings.position')}>
                    <select className="h-9 rounded-md border bg-background px-2 text-sm" value={style.push.top === '0' || style.push.top === 0 ? 'top' : 'footer'} onChange={(e) => patchStyle((st) => { const top = e.target.value === 'top'; st.push.top = top ? '0' : '1'; st.push.bottom = top ? '1' : '0'; })} disabled={!canEdit}>
                      <option value="top">{t('settings.posTop')}</option>
                      <option value="footer">{t('settings.posBottom')}</option>
                    </select>
                  </Field>
                  <ColorField label={t('settings.bgColor')} value={String(style.push.background ?? '#ffffff')} onChange={(v) => patchProp('push', 'background', v)} disabled={!canEdit} />
                </div>

                <Field label={t('datatable.title') /* "Título" */}>
                  <Input maxLength={60} value={style.title} onChange={(e) => patchText('title', e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label={t('settings.webPushSubtitle')}>
                  <Textarea rows={2} value={style.subTitle} onChange={(e) => patchText('subTitle', e.target.value)} disabled={!canEdit} />
                </Field>
                <ColorField label={t('settings.textColor')} value={String(style.textColor.color ?? '#000000')} onChange={(v) => patchProp('textColor', 'color', v)} disabled={!canEdit} />

                {/* permission button */}
                <fieldset className="flex flex-col gap-2 border-t pt-3">
                  <legend className="text-sm font-medium">{t('settings.webPushPermissionButton')}</legend>
                  <Field label={t('settings.webPushButtonText')}><Input value={style.permissionButtonText} onChange={(e) => patchText('permissionButtonText', e.target.value)} disabled={!canEdit} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorField label={t('settings.bgColor')} value={String(style.permissionButton.background ?? '#0FB75C')} onChange={(v) => patchProp('permissionButton', 'background', v)} disabled={!canEdit} />
                    <ColorField label={t('settings.textColor')} value={String(style.permissionButton.color ?? '#ffffff')} onChange={(v) => patchProp('permissionButton', 'color', v)} disabled={!canEdit} />
                  </div>
                  <RadiusField value={String(style.permissionButton['border-radius'] ?? '0px')} onChange={(v) => patchProp('permissionButton', 'border-radius', v)} disabled={!canEdit} />
                </fieldset>

                {/* deny button */}
                <fieldset className="flex flex-col gap-2 border-t pt-3">
                  <legend className="text-sm font-medium">{t('settings.webPushDenyButton')}</legend>
                  <Field label={t('settings.webPushButtonText')}><Input value={style.denyButtonText} onChange={(e) => patchText('denyButtonText', e.target.value)} disabled={!canEdit} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorField label={t('settings.bgColor')} value={String(style.denyButton.background ?? '#EAEAEA')} onChange={(v) => patchProp('denyButton', 'background', v)} disabled={!canEdit} />
                    <ColorField label={t('settings.textColor')} value={String(style.denyButton.color ?? '#A6A6A6')} onChange={(v) => patchProp('denyButton', 'color', v)} disabled={!canEdit} />
                  </div>
                  <RadiusField value={String(style.denyButton['border-radius'] ?? '0px')} onChange={(v) => patchProp('denyButton', 'border-radius', v)} disabled={!canEdit} />
                </fieldset>

                {/* logo url */}
                <Field label={t('settings.webPushLogoUrl')}>
                  <Input value={style.logo} onChange={(e) => patchText('logo', e.target.value)} disabled={!canEdit} placeholder="https://..." />
                </Field>
              </>
            )}

            {/* trigger */}
            <fieldset className="flex flex-col gap-2 border-t pt-3">
              <legend className="text-sm font-medium">Trigger</legend>
              {(['access', 'percentScroll', 'inactive'] as const).map((tr) => (
                <label key={tr} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="wp-trigger" checked={triggerType === tr} onChange={() => changeTrigger(tr, 0)} disabled={!canEdit} />
                  {tr === 'access' && t('settings.triggerOnload')}
                  {tr === 'percentScroll' && t('settings.triggerScroll')}
                  {tr === 'inactive' && t('settings.triggerInactivity')}
                </label>
              ))}
            </fieldset>
          </div>
        </div>
      </section>

      {/* 4. URL filters */}
      <section className="flex max-w-3xl flex-col gap-4">
        <UrlListField label={t('settings.showOn')} addLabel={t('settings.addUrl')} urls={s.urlFilterShow} setUrls={(u) => setUrls('urlFilterShow', u)} disabled={!canEdit} />
        <UrlListField label={t('settings.hideOn')} addLabel={t('settings.addUrl')} urls={s.urlFilterHide.length ? s.urlFilterHide : ['']} setUrls={(u) => setUrls('urlFilterHide', u.filter(Boolean))} disabled={!canEdit} />
        <p className="text-muted-foreground text-xs">{t('settings.urlFilterHint')}</p>
      </section>

      <div>
        <Button type="button" onClick={() => save.mutate()} disabled={!canEdit || save.isPending}>{save.isPending ? '...' : t('common.save')}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// Hex color text + native color picker, kept in sync. Mirrors the Enterprise
// "input-color + input-style" pair.
function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value) ? value : '#ffffff';
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 w-9 cursor-pointer rounded border" aria-label={label} />
        <Input value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="font-mono text-xs uppercase" />
      </div>
    </Field>
  );
}

// Border-radius picker: circle (100px) / rounded (8px) / square (0px) — like the
// Enterprise box-div selector.
function RadiusField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const opts: Array<{ v: string; cls: string }> = [
    { v: '100px', cls: 'rounded-full' },
    { v: '8px', cls: 'rounded-md' },
    { v: '0px', cls: 'rounded-none' },
  ];
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{value === '0px' ? 'Borda reta' : value === '100px' ? 'Borda redonda' : 'Borda arredondada'}</Label>
      <div className="flex gap-1">
        {opts.map((o) => (
          <button key={o.v} type="button" disabled={disabled} onClick={() => onChange(o.v)} className={`flex h-9 flex-1 items-center justify-center border ${value === o.v ? 'border-primary bg-primary/10' : 'border-input'} rounded-md`} aria-label={o.v}>
            <span className={`h-5 w-5 border border-gray-500 ${o.cls}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function UrlListField({ label, addLabel, urls, setUrls, disabled }: { label: string; addLabel: string; urls: string[]; setUrls: (v: string[]) => void; disabled?: boolean }) {
  const list = urls.length ? urls : [''];
  const update = (i: number, v: string) => setUrls(list.map((u, idx) => (idx === i ? v : u)));
  const add = () => setUrls([...list, '']);
  const remove = (i: number) => setUrls(list.length > 1 ? list.filter((_, idx) => idx !== i) : ['']);
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {list.map((u, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder="https://exemplo.com/*" value={u} onChange={(e) => update(i, e.target.value)} disabled={disabled} className="font-mono text-xs" />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={disabled} aria-label="remover">✕</Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>+ {addLabel}</Button>
      </div>
    </div>
  );
}
