import axios from 'axios';
import { WhatsappTemplateSyncService } from './whatsapp-template-sync.service';
import type { WhatsappModeResolverService } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.service';
import type { Repository } from 'typeorm';
import type { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import type { AccountConfigEntity } from '../../entities/account-config.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildService(opts: { channel: Partial<WhatsappChannelEntity> | null; accountConfig?: Partial<AccountConfigEntity> | null; resolveChannel?: jest.Mock }) {
  const channels = {
    findOne: jest.fn().mockResolvedValue(opts.channel ?? null),
  } as unknown as Repository<WhatsappChannelEntity>;
  const accountConfigs = {
    findOne: jest.fn().mockResolvedValue(opts.accountConfig ?? null),
  } as unknown as Repository<AccountConfigEntity>;
  const resolver = {
    resolveChannel: opts.resolveChannel ?? jest.fn().mockResolvedValue({ baseUrl: 'https://graph.facebook.com/v18.0', bearerToken: 'tok', phoneNumberId: '111', mode: 'meta' }),
  } as unknown as WhatsappModeResolverService;
  return new WhatsappTemplateSyncService(channels, accountConfigs, resolver);
}

describe('WhatsappTemplateSyncService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('sanitiseName', () => {
    it('lowercases, replaces non-allowed chars and trims leading underscores', () => {
      const svc = buildService({ channel: null });
      expect(svc.sanitiseName('Order Update v2!')).toBe('order_update_v2_');
      expect(svc.sanitiseName('--ALERTA-3')).toBe('alerta_3');
    });
  });

  describe('buildPayload — regular WhatsApp', () => {
    const svc = buildService({ channel: null });

    it('builds a body-only template when content has no header/footer/button', () => {
      const payload = svc.buildPayload({
        name: 'order_update',
        language: 'pt_BR',
        shortlinkBaseUrl: null,
        messageDto: { type: 'whatsapp', content: JSON.stringify({ body: 'Olá!' }) } as any,
      });
      expect(payload.category).toBe('MARKETING');
      expect(payload.components).toEqual([{ type: 'BODY', text: 'Olá!' }]);
    });

    it('converts %VARIABLES% into numbered Meta placeholders with examples', () => {
      const payload = svc.buildPayload({
        name: 'n',
        language: 'pt_BR',
        shortlinkBaseUrl: null,
        messageDto: { type: 'whatsapp', content: 'Fala, %FIRSTNAME%, de %cidade%. Tchau %FIRSTNAME%' } as any,
      });
      expect(payload.components).toEqual([
        { type: 'BODY', text: 'Fala, {{1}}, de {{2}}. Tchau {{1}}', example: { body_text: [['Maria', 'exemplo']] } },
      ]);
    });

    it('includes a TEXT header when headerType=text', () => {
      const payload = svc.buildPayload({
        name: 'n',
        language: 'pt_BR',
        shortlinkBaseUrl: null,
        messageDto: { type: 'whatsapp', content: JSON.stringify({ headerType: 'text', headerContent: 'Bem-vindo', body: 'corpo' }) } as any,
      });
      expect(payload.components[0]).toEqual({ type: 'HEADER', format: 'TEXT', text: 'Bem-vindo' });
    });

    it('includes an IMAGE header with url when headerType=image', () => {
      const payload = svc.buildPayload({
        name: 'n',
        language: 'pt_BR',
        shortlinkBaseUrl: null,
        messageDto: { type: 'whatsapp', content: JSON.stringify({ headerType: 'image', headerContent: 'https://img/x.png', body: 'corpo' }) } as any,
      });
      expect(payload.components[0]).toEqual({ type: 'HEADER', format: 'IMAGE', url: 'https://img/x.png' });
    });

    it('appends a FOOTER when footer is set', () => {
      const payload = svc.buildPayload({
        name: 'n',
        language: 'pt_BR',
        shortlinkBaseUrl: null,
        messageDto: { type: 'whatsapp', content: JSON.stringify({ body: 'b', footer: 'rodape' }) } as any,
      });
      expect(payload.components[payload.components.length - 1]).toEqual({ type: 'FOOTER', text: 'rodape' });
    });

    it('appends a URL BUTTON with substitution slot when whatsappType=call-to-action', () => {
      const payload = svc.buildPayload({
        name: 'n',
        language: 'pt_BR',
        shortlinkBaseUrl: 'https://short.bms/',
        messageDto: { type: 'whatsapp', whatsappType: 'call-to-action', callToActionText: 'Saiba mais', content: JSON.stringify({ body: 'b' }) } as any,
      });
      const button = payload.components.find((c) => c.type === 'BUTTONS');
      expect(button).toBeDefined();
      expect(button?.buttons?.[0]).toMatchObject({ type: 'URL', text: 'Saiba mais', url: 'https://short.bms/{{1}}' });
    });
  });

  describe('buildPayload — 2FA template', () => {
    it('returns AUTHENTICATION category with security + footer + OTP button', () => {
      const svc = buildService({ channel: null });
      const payload = svc.buildPayload({
        name: 'otp_code',
        language: 'pt_BR',
        shortlinkBaseUrl: null,
        messageDto: { type: '2FA-whatsapp' } as any,
      });
      expect(payload.category).toBe('AUTHENTICATION');
      expect(payload.components.map((c) => c.type)).toEqual(['BODY', 'FOOTER', 'BUTTONS']);
      expect(payload.components[0].add_security_recommendation).toBe(true);
      expect(payload.components[2].buttons?.[0]).toMatchObject({ type: 'OTP', otp_type: 'COPY_CODE' });
    });
  });

  describe('syncMessageToMeta — error paths', () => {
    it('throws PRECONDITION_FAILED when no active channel exists', async () => {
      const svc = buildService({ channel: null });
      await expect(svc.syncMessageToMeta({ accountId: 7, type: 'whatsapp', content: '{}', title: 't' } as any, 'name')).rejects.toMatchObject({ status: 412 });
    });

    it('throws when channel exists but waba_id is missing', async () => {
      const svc = buildService({ channel: { id: 1, accountId: 7, mode: 'meta', accessToken: 'tok', phoneNumberId: 'p1', wabaId: null } as any });
      await expect(svc.syncMessageToMeta({ accountId: 7, type: 'whatsapp', content: '{}', title: 't' } as any, 'name')).rejects.toMatchObject({ status: 412 });
    });

    it('throws BadRequest when accountId cannot be derived', async () => {
      const svc = buildService({ channel: null });
      await expect(svc.syncMessageToMeta({ type: 'whatsapp', content: '{}', title: 't' } as any, 'name')).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('syncMessageToMeta — happy path', () => {
    it('POSTs to {baseUrl}/{waba_id}/message_templates and returns name+status', async () => {
      const svc = buildService({
        channel: { id: 1, accountId: 7, mode: 'meta', accessToken: 'tok', channelToken: null, phoneNumberId: '111', wabaId: '999' } as any,
        accountConfig: { value: 'pt_BR' } as any,
      });
      (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'tmpl_meta_id', status: 'PENDING' } });

      const result = await svc.syncMessageToMeta({ accountId: 7, type: 'whatsapp', content: JSON.stringify({ body: 'b' }), title: 't' } as any, 'My Template');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/999/message_templates',
        expect.objectContaining({ name: 'my_template', category: 'MARKETING', language: 'pt_BR' }),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
      );
      expect(result).toEqual({ name: 'my_template', metaTemplateId: 'tmpl_meta_id', status: 'PENDING' });
    });
  });
});
