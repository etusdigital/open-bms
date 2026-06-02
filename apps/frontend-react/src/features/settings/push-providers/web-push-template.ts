// Web-push opt-in builder — generation contract, ported from the Enterprise Vue
// PushConfig.vue (same product, single source of truth). This is the LOAD-BEARING
// part: web-push.js on the customer page reads ONLY these fields from
// webpush_settings → { html, mobileHtml, scriptToRun, isMobileSameTemplate }.
// The editor fields are just bindings on top of the style objects below.
//
// NON-NEGOTIABLES (break silently if changed):
//  - class names .bms-push-alert / .bms-permission-button / .bms-deny-button —
//    web-push.js queries these exact selectors.
//  - scriptToRun is eval'd inside the bmsPush instance; it references
//    `this.requestPermission()` and `this.webpush_settings.template`.
//  - the `replaceForComma` convention: transformIntoStyle turns `,`→`;`, so any
//    CSS value that legitimately needs a comma encodes it as `replaceForComma`
//    (e.g. transform: translate(50%replaceForComma 0)) and it's restored last.

export type PushTemplateName = 'default' | 'bar' | 'native';

export interface PushStyle {
  logo: string;
  push: Record<string, string | number>;
  divTitle: Record<string, string>;
  divText: Record<string, string>;
  logoStyle: Record<string, string>;
  title: string;
  titleStyle: Record<string, string>;
  subTitle: string;
  subTitleStyle: Record<string, string>;
  textColor: Record<string, string>;
  divButtonStyle: Record<string, string>;
  buttonStyle: Record<string, string>;
  permissionButton: Record<string, string>;
  permissionButtonText: string;
  denyButton: Record<string, string>;
  denyButtonText: string;
}

export interface WebPushSettings {
  isActive: boolean;
  template: PushTemplateName;
  utmSource: string;
  utmMedium: string;
  utmName: string;
  scriptShowPush: string;
  scriptType: 'access' | 'percentScroll' | 'inactive';
  pushStyle: PushStyle;
  urls: string[];
  urlFilterShow: string[];
  urlFilterHide: string[];
  isMobileSameTemplate: boolean;
  scriptToRun: string;
  mobileTemplate: PushTemplateName;
  mobileScriptType: 'access' | 'percentScroll' | 'inactive';
  mobileScriptShowPush: string;
  pushMobileStyle: PushStyle;
  html: string;
  mobileHtml: string;
}

export const DEFAULT_LOGO = 'https://assets.bri.us/bms/default-logo.png';

// Serializes a style object to an inline-style string. Mirrors the Vue
// transformIntoStyle EXACTLY (comma→semicolon, then replaceForComma→comma).
export function transformIntoStyle(obj: Record<string, string | number> | undefined): string {
  if (!obj) return '';
  return (
    JSON.stringify(obj)
      .replaceAll('{', '')
      .replaceAll('}', '')
      .replaceAll('"', '')
      .replaceAll(',', ';')
      .replaceAll('replaceForComma', ',') + ';'
  );
}

// Default desktop style — mirrors PushConfig.vue beforeMount pushStyle.
export function defaultPushStyle(): PushStyle {
  return {
    logo: DEFAULT_LOGO,
    push: {
      position: 'fixed',
      display: 'flex',
      'flex-direction': 'column',
      'justify-content': 'flex-start',
      'align-items': 'flex-end',
      width: 'fit-content',
      top: '0',
      right: '50%',
      padding: '20px',
      background: '#ffffff',
      'border-radius': '0px',
      border: 'none',
      transform: 'translate(50%replaceForComma 0)',
      'z-index': 999999999,
      'box-shadow': ' 0px 1px 3px #0000001a',
    },
    divTitle: { display: 'flex', 'align-items': 'flex-start', 'flex-direction': 'row' },
    divText: { 'text-align': 'start' },
    logoStyle: { display: 'block', width: '64px', height: '64px', 'margin-right': '16px', 'margin-left': '0px' },
    title: 'Título do opt-in',
    titleStyle: { 'font-size': '16px', 'line-height': '130%', 'font-weight': 'bold', 'margin-bottom': '8px !important' },
    subTitle: 'Lorem ipsum dolor sit amet consectetur. Nunc nibh ut purus diam. Ultrices erat enim massa.',
    subTitleStyle: { 'font-size': '14px', 'line-height': '130%', 'margin-bottom': '24px !important' },
    textColor: { color: '#000000' },
    divButtonStyle: { display: 'flex', 'flex-direction': 'row', 'justify-content': 'flex-end', height: 'fit-content', gap: '8px' },
    buttonStyle: { padding: '10px 20px', cursor: 'pointer' },
    permissionButton: { 'border-radius': '0px', background: '#0FB75C', color: '#ffffff', border: 'none' },
    permissionButtonText: 'Permitir',
    denyButton: { 'border-radius': '0px', background: '#EAEAEA', color: '#A6A6A6', border: 'none' },
    denyButtonText: 'Não',
  };
}

// Default mobile style — mirrors PushConfig.vue beforeMount pushMobileStyle
// (full-width, top:0px, align-items flex-start; buttons align-self flex-end).
export function defaultPushMobileStyle(): PushStyle {
  const s = defaultPushStyle();
  return {
    ...s,
    push: {
      position: 'fixed',
      display: 'flex',
      'flex-direction': 'column',
      'justify-content': 'flex-start',
      'align-items': 'flex-start',
      width: '100%',
      padding: '20px',
      background: '#ffffff',
      'border-radius': '0px',
      border: 'none',
      top: '0px',
      'z-index': 999999999,
      'box-shadow': ' 0px 1px 3px #0000001a',
    },
    divButtonStyle: { display: 'flex', 'flex-direction': 'row', 'justify-content': 'flex-end', 'align-self': 'flex-end', height: 'fit-content', gap: '8px' },
  };
}

// Per-template style overrides (default/defaultRight/bar/native) — from
// PushConfig.vue pushTemplates. changeTemplate merges these into the style.
export const PUSH_TEMPLATES: Record<string, Partial<Record<keyof PushStyle, Record<string, string>>>> = {
  default: {
    push: { 'flex-direction': 'column', 'justify-content': 'flex-start', 'align-items': 'flex-end', width: 'fit-content', 'box-shadow': ' 0px 1px 3px #0000001a' },
    divTitle: { 'flex-direction': 'row' },
    logoStyle: { 'margin-right': '16px', 'margin-left': '0px' },
    subTitleStyle: { 'margin-bottom': '24px !important' },
    divButtonStyle: { 'flex-direction': 'row' },
  },
  defaultRight: {
    push: { 'flex-direction': 'column', 'justify-content': 'flex-start', 'align-items': 'flex-end', width: 'fit-content' },
    divTitle: { 'flex-direction': 'row-reverse', 'align-items': 'flex-start' },
    logoStyle: { 'margin-right': '0px', 'margin-left': '16px' },
    subTitleStyle: { 'margin-bottom': '24px !important' },
    divButtonStyle: { 'flex-direction': 'row' },
  },
  bar: {
    push: { 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'center', width: '95%' },
    divTitle: { 'flex-direction': 'row', 'align-items': 'center' },
    logoStyle: { 'margin-right': '16px', 'margin-left': '0px' },
    subTitleStyle: { 'margin-bottom': '0px !important' },
    divButtonStyle: { 'flex-direction': 'row' },
  },
  native: {
    push: { 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'center', width: '95%' },
  },
};

// Apply a template's overrides onto a style object (mirrors changeTemplate).
export function applyTemplate(style: PushStyle, template: string): PushStyle {
  const tpl = PUSH_TEMPLATES[template];
  if (!tpl) return style;
  const next: PushStyle = JSON.parse(JSON.stringify(style));
  for (const section of Object.keys(tpl) as (keyof PushStyle)[]) {
    const overrides = tpl[section]!;
    for (const prop of Object.keys(overrides)) {
      (next[section] as Record<string, string>)[prop] = overrides[prop];
    }
  }
  return next;
}

// Builds the opt-in popup HTML from a style object. Mirrors the @Watch('pushStyle')
// changePush() output (deny button first, then permission — the order the watcher
// emits, NOT the crossed order in beforeMount).
export function buildPushHtml(style: PushStyle): string {
  const t = transformIntoStyle;
  return `
      <div style="${t(style.push)}" class="bms-push-alert">
        <div style="${t(style.divTitle)}">
          <img src="${style.logo}" style="${t(style.logoStyle)}">
          <div style="${t(style.divText)}">
            <h5 style="${t(style.textColor)} ${t(style.titleStyle)}">${style.title}</h5>
            <p style="${t(style.textColor)} ${t(style.subTitleStyle)}">${style.subTitle}</p>
          </div>
        </div>
        <div style="${t(style.divButtonStyle)}">
          <button class="bms-deny-button" style="${t(style.buttonStyle)} ${t(style.denyButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
            ${style.denyButtonText}
          </button>
          <button class="bms-permission-button" style="${t(style.buttonStyle)} ${t(style.permissionButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
            ${style.permissionButtonText}
          </button>
        </div>
      </div>
    `;
}

// Per-trigger show script. Mirrors PushFormatting.changeScript. `value` is the
// raw editor number; access/inactive multiply by 1000 (ms), percentScroll is %.
export function buildShowScript(trigger: 'access' | 'percentScroll' | 'inactive', value: number): string {
  if (trigger === 'access') {
    return `
          const scriptValue = ${value * 1000};
          const pushAlert = document.querySelector(".bms-push-alert");
          pushAlert.style.display = "none";
          setTimeout(() => {
            if(this.webpush_settings.template === 'native') {
              this.requestPermission();
            } else {
              pushAlert.style.display = "flex";
            }
          }, scriptValue);`;
  }
  if (trigger === 'percentScroll') {
    return `
          const scriptValue = ${value};
          const pushAlert = document.querySelector(".bms-push-alert");
          pushAlert.style.display = "none";
          window.addEventListener('scroll', ()=> {
            const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;

            if (scrollPercent >= scriptValue) {
              if(this.webpush_settings.template === 'native') {
                this.requestPermission();
              } else {
                pushAlert.style.display = "flex";
              }
            }
          });`;
  }
  // inactive
  return `
          const pushAlert = document.querySelector(".bms-push-alert");
          pushAlert.style.display = "none";
          let inactivityTimeout;

          function resetInactivityTimer() {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = setTimeout(() => {
              if(this.webpush_settings.template === 'native') {
                this.requestPermission();
              } else {
                pushAlert.style.display = "flex";
              }
            }, ${value * 1000});
          }

          window.addEventListener('mousemove', resetInactivityTimer);
          window.addEventListener('keydown', resetInactivityTimer);

          resetInactivityTimer();`;
}

// Assembles the final scriptToRun from the desktop + mobile show-scripts and the
// URL filters. Mirrors PushConfig.getFinalScript EXACTLY (string is eval'd on the
// page, so the shape must match).
export function buildFinalScript(s: {
  isMobileSameTemplate: boolean;
  urlFilterShow: string[];
  urlFilterHide: string[];
  scriptShowPush: string;
  mobileScriptShowPush: string;
}): string {
  return `
      const bmsIsMobileSameTemplate = ${s.isMobileSameTemplate};
      const bmsIsMobile = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune|Windows Phone/i.test(navigator.userAgent);
      const urlFilterShow = ${JSON.stringify(s.urlFilterShow)};
      const urlFilterHide = ${JSON.stringify(s.urlFilterHide)};
      function shouldLoadBmsPush(filter) {
        let urlObject = new URL(location.href);
        let pathAndQuery = (urlObject.pathname + urlObject.search).toLowerCase();
        const hasStartingWildcard = filter.startsWith('*');
        const hasEndingWildcard = filter.endsWith('*');
        let processedFilter = filter.replaceAll('*', '').toLowerCase();

        if (pathAndQuery.startsWith('/')) {
          pathAndQuery = pathAndQuery.slice(1);
        }

        if (hasStartingWildcard && hasEndingWildcard) {
          return pathAndQuery.includes(processedFilter);
        } else if (hasStartingWildcard) {
          return pathAndQuery.endsWith(processedFilter);
        } else if (hasEndingWildcard) {
          return pathAndQuery.startsWith(processedFilter);
        } else {
          return pathAndQuery === processedFilter;
        }
      }

      if (urlFilterShow.some((filter) => shouldLoadBmsPush(filter)) && urlFilterHide.some((filter) => shouldLoadBmsPush(filter)) === false) {
        if (!bmsIsMobile || bmsIsMobile && bmsIsMobileSameTemplate) {
          ${s.scriptShowPush}
        } else if (bmsIsMobile && !bmsIsMobileSameTemplate) {
          ${s.mobileScriptShowPush}
        }
      } else {
        const pushAlert = document.querySelector(".bms-push-alert");
        pushAlert.style.display = "none";
      }
    `;
}

// Creates a fresh full settings object with all generated fields populated.
// Mirrors the PushConfig.vue beforeMount default branch + the watchers' output.
export function createDefaultWebPushSettings(accountUrl = ''): WebPushSettings {
  const pushStyle = defaultPushStyle();
  const pushMobileStyle = defaultPushMobileStyle();
  const urlFilterShow = ['*'];
  const urlFilterHide: string[] = [];
  const scriptShowPush = buildShowScript('access', 0);
  const mobileScriptShowPush = buildShowScript('access', 0);
  const scriptToRun = buildFinalScript({ isMobileSameTemplate: true, urlFilterShow, urlFilterHide, scriptShowPush, mobileScriptShowPush });
  return {
    isActive: true,
    template: 'default',
    utmSource: '',
    utmMedium: '',
    utmName: '',
    scriptShowPush,
    scriptType: 'access',
    pushStyle,
    urls: [accountUrl || ''],
    urlFilterShow,
    urlFilterHide,
    isMobileSameTemplate: true,
    scriptToRun,
    mobileTemplate: 'default',
    mobileScriptType: 'access',
    mobileScriptShowPush,
    pushMobileStyle,
    html: buildPushHtml(pushStyle),
    mobileHtml: buildPushHtml(pushMobileStyle),
  };
}

// Recompute all generated fields (html/mobileHtml/scriptToRun) from the current
// editable state — call after every edit before save. This is what guarantees the
// stored webpush_settings carries a runtime-valid contract.
export function regenerate(s: WebPushSettings): WebPushSettings {
  return {
    ...s,
    html: buildPushHtml(s.pushStyle),
    mobileHtml: buildPushHtml(s.pushMobileStyle),
    scriptToRun: buildFinalScript({
      isMobileSameTemplate: s.isMobileSameTemplate,
      urlFilterShow: s.urlFilterShow,
      urlFilterHide: s.urlFilterHide,
      scriptShowPush: s.scriptShowPush,
      mobileScriptShowPush: s.mobileScriptShowPush,
    }),
  };
}
