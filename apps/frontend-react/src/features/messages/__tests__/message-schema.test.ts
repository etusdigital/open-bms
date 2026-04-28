import { describe, it, expect } from 'vitest';
import {
  emailFormSchema,
  smsFormSchema,
  webPushFormSchema,
  mobilePushFormSchema,
  whatsappFormSchema,
} from '../message-schema';

describe('emailFormSchema', () => {
  const validEmail = {
    title: 'Welcome Email',
    description: '',
    ippool: 'default-pool',
    fromName: 'Sender Name',
    fromMail: 'sender@example.com',
    replyTo: '',
    subject: 'Welcome!',
    previewText: '',
    priority: 'high' as const,
    content: '',
    content_json: '',
  };

  it('accepts valid email form data', () => {
    const result = emailFormSchema.safeParse(validEmail);
    expect(result.success).toBe(true);
  });

  it('requires ippool', () => {
    const result = emailFormSchema.safeParse({ ...validEmail, ippool: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('ippool');
    }
  });

  it('requires fromName with min 4 chars', () => {
    const result = emailFormSchema.safeParse({ ...validEmail, fromName: 'Ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('fromName');
    }
  });

  it('requires fromMail to be a valid email', () => {
    const result = emailFormSchema.safeParse({ ...validEmail, fromMail: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('fromMail');
    }
  });

  it('requires fromMail to not be empty', () => {
    const result = emailFormSchema.safeParse({ ...validEmail, fromMail: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('fromMail');
    }
  });

  it('requires subject with min 3 chars', () => {
    const result = emailFormSchema.safeParse({ ...validEmail, subject: 'AB' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('subject');
    }
  });

  it('validates priority enum (low, normal, high)', () => {
    expect(emailFormSchema.safeParse({ ...validEmail, priority: 'low' }).success).toBe(true);
    expect(emailFormSchema.safeParse({ ...validEmail, priority: 'normal' }).success).toBe(true);
    expect(emailFormSchema.safeParse({ ...validEmail, priority: 'high' }).success).toBe(true);
    expect(emailFormSchema.safeParse({ ...validEmail, priority: 'urgent' }).success).toBe(false);
  });

  it('defaults priority to high', () => {
    const { priority: _priority, ...withoutPriority } = validEmail;
    const result = emailFormSchema.safeParse(withoutPriority);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('high');
    }
  });

  it('allows optional replyTo and previewText', () => {
    const result = emailFormSchema.safeParse({
      ...validEmail,
      replyTo: undefined,
      previewText: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('allows optional content and content_json (default to empty string)', () => {
    const result = emailFormSchema.safeParse({
      ...validEmail,
      content: undefined,
      content_json: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe('');
      expect(result.data.content_json).toBe('');
    }
  });
});

describe('smsFormSchema', () => {
  const validSms = { title: 'SMS Test', description: '', content: 'Hello' };

  it('accepts valid SMS data', () => {
    expect(smsFormSchema.safeParse(validSms).success).toBe(true);
  });

  it('requires content', () => {
    const result = smsFormSchema.safeParse({ ...validSms, content: '' });
    expect(result.success).toBe(false);
  });
});

describe('webPushFormSchema', () => {
  const validPush = {
    title: 'Push Test',
    description: '',
    subject: 'Notification',
    content: 'Body',
    url: '',
  };

  it('accepts valid web push data', () => {
    expect(webPushFormSchema.safeParse(validPush).success).toBe(true);
  });

  it('requires subject (max 60 chars)', () => {
    const result = webPushFormSchema.safeParse({ ...validPush, subject: '' });
    expect(result.success).toBe(false);
  });

  it('rejects subject over 60 chars', () => {
    const result = webPushFormSchema.safeParse({ ...validPush, subject: 'A'.repeat(61) });
    expect(result.success).toBe(false);
  });

  it('defaults expiryPushFilter to day', () => {
    const result = webPushFormSchema.safeParse(validPush);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiryPushFilter).toBe('day');
    }
  });
});

describe('mobilePushFormSchema', () => {
  const validPush = {
    title: 'Push Test',
    description: '',
    subject: 'Notification',
    content: 'Body',
    url: '',
  };

  it('accepts valid mobile push data', () => {
    expect(mobilePushFormSchema.safeParse(validPush).success).toBe(true);
  });

  it('defaults notificationSound to default', () => {
    const result = mobilePushFormSchema.safeParse(validPush);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notificationSound).toBe('default');
    }
  });
});

describe('whatsappFormSchema', () => {
  const validWhatsapp = { title: 'WhatsApp Test', description: '', content: 'Hello' };

  it('accepts valid whatsapp data', () => {
    expect(whatsappFormSchema.safeParse(validWhatsapp).success).toBe(true);
  });

  it('requires content', () => {
    const result = whatsappFormSchema.safeParse({ ...validWhatsapp, content: '' });
    expect(result.success).toBe(false);
  });

  it('defaults headerType to none', () => {
    const result = whatsappFormSchema.safeParse(validWhatsapp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headerType).toBe('none');
    }
  });

  it('defaults whatsappType to text', () => {
    const result = whatsappFormSchema.safeParse(validWhatsapp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsappType).toBe('text');
    }
  });

  it('validates headerType enum', () => {
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, headerType: 'text' }).success).toBe(true);
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, headerType: 'image' }).success).toBe(true);
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, headerType: 'video' }).success).toBe(true);
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, headerType: 'invalid' }).success).toBe(false);
  });

  it('validates whatsappType enum', () => {
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, whatsappType: 'text' }).success).toBe(true);
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, whatsappType: 'call-to-action' }).success).toBe(true);
    expect(whatsappFormSchema.safeParse({ ...validWhatsapp, whatsappType: 'invalid' }).success).toBe(false);
  });

  it('accepts base64 image data in headerContent (longer than 5000 chars)', () => {
    const longBase64 = 'data:image/png;base64,' + 'A'.repeat(10000);
    const result = whatsappFormSchema.safeParse({
      ...validWhatsapp,
      headerType: 'image',
      headerContent: longBase64,
    });
    expect(result.success).toBe(true);
  });

  it('accepts base64 video data in headerContent (longer than 5000 chars)', () => {
    const longBase64 = 'data:video/mp4;base64,' + 'A'.repeat(50000);
    const result = whatsappFormSchema.safeParse({
      ...validWhatsapp,
      headerType: 'video',
      headerContent: longBase64,
    });
    expect(result.success).toBe(true);
  });

  it('still validates text headerContent max length', () => {
    const result = whatsappFormSchema.safeParse({
      ...validWhatsapp,
      headerType: 'text',
      headerContent: 'A'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('strips callToActionText when whatsappType is text', () => {
    const result = whatsappFormSchema.safeParse({
      ...validWhatsapp,
      whatsappType: 'text',
      callToActionText: '',
      callToActionUrl: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.callToActionText).toBeUndefined();
      expect(result.data.callToActionUrl).toBeUndefined();
    }
  });

  it('keeps callToActionText when whatsappType is call-to-action', () => {
    const result = whatsappFormSchema.safeParse({
      ...validWhatsapp,
      whatsappType: 'call-to-action',
      callToActionText: 'Click me',
      callToActionUrl: 'https://example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.callToActionText).toBe('Click me');
      expect(result.data.callToActionUrl).toBe('https://example.com');
    }
  });
});
