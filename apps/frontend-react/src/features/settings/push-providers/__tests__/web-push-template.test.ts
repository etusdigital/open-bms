import { describe, it, expect } from 'vitest';
import {
  transformIntoStyle,
  buildPushHtml,
  buildShowScript,
  buildFinalScript,
  applyTemplate,
  createDefaultWebPushSettings,
  regenerate,
  defaultPushStyle,
} from '../web-push-template';

// The web-push.js on the customer page reads ONLY html / mobileHtml / scriptToRun
// / isMobileSameTemplate from webpush_settings. These tests lock that contract —
// the exact class names it binds, the eval'd script shape, and the
// comma-encoding hack — because all of them break SILENTLY in the browser.

describe('transformIntoStyle', () => {
  it('serializes to inline style, comma→semicolon, restoring replaceForComma', () => {
    expect(transformIntoStyle({ a: '1', b: '2' })).toBe('a:1;b:2;');
  });
  it('restores replaceForComma to a real comma (the translate hack)', () => {
    expect(transformIntoStyle({ transform: 'translate(50%replaceForComma 0)' })).toBe('transform:translate(50%, 0);');
  });
  it('returns empty string for undefined', () => {
    expect(transformIntoStyle(undefined)).toBe('');
  });
});

describe('buildPushHtml — the exact contract web-push.js binds', () => {
  const html = buildPushHtml(defaultPushStyle());
  it('carries the three load-bearing class names', () => {
    expect(html).toContain('class="bms-push-alert"');
    expect(html).toContain('class="bms-deny-button"');
    expect(html).toContain('class="bms-permission-button"');
  });
  it('emits deny button before permission button (watcher order, not beforeMount order)', () => {
    expect(html.indexOf('bms-deny-button')).toBeLessThan(html.indexOf('bms-permission-button'));
  });
  it('inlines title/subtitle/button text', () => {
    expect(html).toContain('Título do opt-in');
    expect(html).toContain('Permitir');
    expect(html).toContain('Não');
  });
  it('does NOT leave the replaceForComma sentinel in the output', () => {
    expect(html).not.toContain('replaceForComma');
  });
});

describe('buildShowScript', () => {
  it('access multiplies seconds → ms and references this.requestPermission()', () => {
    const s = buildShowScript('access', 5);
    expect(s).toContain('const scriptValue = 5000;');
    expect(s).toContain('this.requestPermission()');
    expect(s).toContain('this.webpush_settings.template');
  });
  it('percentScroll uses the raw percent', () => {
    expect(buildShowScript('percentScroll', 50)).toContain('const scriptValue = 50;');
  });
  it('inactive multiplies seconds → ms', () => {
    expect(buildShowScript('inactive', 3)).toContain('3000');
  });
});

describe('buildFinalScript', () => {
  it('embeds the url filters and both show-scripts', () => {
    const s = buildFinalScript({
      isMobileSameTemplate: true,
      urlFilterShow: ['*'],
      urlFilterHide: ['/checkout'],
      scriptShowPush: '/*DESKTOP*/',
      mobileScriptShowPush: '/*MOBILE*/',
    });
    expect(s).toContain('const urlFilterShow = ["*"];');
    expect(s).toContain('const urlFilterHide = ["/checkout"];');
    expect(s).toContain('/*DESKTOP*/');
    expect(s).toContain('/*MOBILE*/');
    expect(s).toContain('const bmsIsMobileSameTemplate = true;');
    expect(s).toContain('function shouldLoadBmsPush(filter)');
  });
});

describe('applyTemplate', () => {
  it('bar template switches push to a row layout', () => {
    const styled = applyTemplate(defaultPushStyle(), 'bar');
    expect(styled.push['flex-direction']).toBe('row');
    expect(styled.push['justify-content']).toBe('space-between');
  });
  it('does not mutate the input', () => {
    const base = defaultPushStyle();
    applyTemplate(base, 'bar');
    expect(base.push['flex-direction']).toBe('column');
  });
});

describe('createDefaultWebPushSettings + regenerate', () => {
  it('produces a settings object with a runtime-valid contract', () => {
    const s = createDefaultWebPushSettings('https://shop.example.com');
    // generated fields are the ONLY thing web-push.js reads:
    expect(s.html).toContain('bms-push-alert');
    expect(s.mobileHtml).toContain('bms-push-alert');
    expect(s.scriptToRun).toContain('shouldLoadBmsPush');
    expect(s.isMobileSameTemplate).toBe(true);
    expect(s.urls[0]).toBe('https://shop.example.com');
  });

  it('regenerate refreshes html/scriptToRun from edited state', () => {
    const s = createDefaultWebPushSettings();
    const edited = {
      ...s,
      pushStyle: { ...s.pushStyle, title: 'Novo título', denyButtonText: 'Agora não' },
      urlFilterHide: ['/admin*'],
    };
    const out = regenerate(edited);
    expect(out.html).toContain('Novo título');
    expect(out.html).toContain('Agora não');
    expect(out.scriptToRun).toContain('"/admin*"');
  });
});
