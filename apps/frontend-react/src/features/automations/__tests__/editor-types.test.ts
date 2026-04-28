import { describe, it, expect } from 'vitest';
import {
  KNOWN_STEP_TYPES,
  BRANCHING_STEP_TYPES,
  SUB_NODE_TYPES,
  MESSAGE_TYPE_MAP,
  CHANNEL_FLAG_MAP,
  NODE_SPACING,
  NODE_WIDTH,
} from '../editor/types';

describe('editor types constants', () => {
  describe('KNOWN_STEP_TYPES', () => {
    it('is a Set', () => {
      expect(KNOWN_STEP_TYPES).toBeInstanceOf(Set);
    });

    it('contains all message channel types', () => {
      for (const type of ['email', 'webPush', 'mobilePush', 'sms', 'whatsapp']) {
        expect(KNOWN_STEP_TYPES.has(type)).toBe(true);
      }
    });

    it('contains trigger and end', () => {
      expect(KNOWN_STEP_TYPES.has('trigger')).toBe(true);
      expect(KNOWN_STEP_TYPES.has('end')).toBe(true);
    });

    it('contains all random message types', () => {
      for (const type of ['randomMessage', 'randomWebPush', 'randomMobilePush']) {
        expect(KNOWN_STEP_TYPES.has(type)).toBe(true);
      }
    });

    it('contains all contact step types', () => {
      for (const type of [
        'addTag',
        'removeTag',
        'updateCustomField',
        'contactValidate',
        'contactTransfer',
        'removeAutomation',
      ]) {
        expect(KNOWN_STEP_TYPES.has(type)).toBe(true);
      }
    });

    it('contains all condition step types', () => {
      for (const type of [
        'split',
        'splitPath',
        'conditional',
        'conditionalTrue',
        'conditionalFalse',
        'conditionalTime',
      ]) {
        expect(KNOWN_STEP_TYPES.has(type)).toBe(true);
      }
    });

    it('contains integration types', () => {
      expect(KNOWN_STEP_TYPES.has('httpRequest')).toBe(true);
    });

    it('contains testAB and wait', () => {
      expect(KNOWN_STEP_TYPES.has('testAB')).toBe(true);
      expect(KNOWN_STEP_TYPES.has('wait')).toBe(true);
    });

    it('does not contain unknown types', () => {
      expect(KNOWN_STEP_TYPES.has('foobar')).toBe(false);
      expect(KNOWN_STEP_TYPES.has('')).toBe(false);
    });
  });

  describe('BRANCHING_STEP_TYPES', () => {
    it('contains split and conditional', () => {
      expect(BRANCHING_STEP_TYPES.has('split')).toBe(true);
      expect(BRANCHING_STEP_TYPES.has('conditional')).toBe(true);
    });

    it('has exactly 2 entries', () => {
      expect(BRANCHING_STEP_TYPES.size).toBe(2);
    });

    it('does not contain sub-node types', () => {
      expect(BRANCHING_STEP_TYPES.has('splitPath')).toBe(false);
      expect(BRANCHING_STEP_TYPES.has('conditionalTrue')).toBe(false);
    });
  });

  describe('SUB_NODE_TYPES', () => {
    it('contains splitPath, conditionalTrue, conditionalFalse', () => {
      expect(SUB_NODE_TYPES.has('splitPath')).toBe(true);
      expect(SUB_NODE_TYPES.has('conditionalTrue')).toBe(true);
      expect(SUB_NODE_TYPES.has('conditionalFalse')).toBe(true);
    });

    it('has exactly 3 entries', () => {
      expect(SUB_NODE_TYPES.size).toBe(3);
    });
  });

  describe('MESSAGE_TYPE_MAP', () => {
    it('maps single-message step types to API type strings', () => {
      expect(MESSAGE_TYPE_MAP['email']).toBe('email');
      expect(MESSAGE_TYPE_MAP['webPush']).toBe('web-push');
      expect(MESSAGE_TYPE_MAP['mobilePush']).toBe('mobile-push');
      expect(MESSAGE_TYPE_MAP['sms']).toBe('sms');
      expect(MESSAGE_TYPE_MAP['whatsapp']).toBe('whatsapp');
    });

    it('maps random-message step types to correct API types', () => {
      expect(MESSAGE_TYPE_MAP['randomMessage']).toBe('email');
      expect(MESSAGE_TYPE_MAP['randomWebPush']).toBe('web-push');
      expect(MESSAGE_TYPE_MAP['randomMobilePush']).toBe('mobile-push');
    });

    it('has entries for all message-related step types', () => {
      const expected = [
        'email',
        'webPush',
        'mobilePush',
        'sms',
        'whatsapp',
        'randomMessage',
        'randomWebPush',
        'randomMobilePush',
      ];
      for (const key of expected) {
        expect(MESSAGE_TYPE_MAP).toHaveProperty(key);
      }
    });

    it('does not have entries for non-message types', () => {
      expect(MESSAGE_TYPE_MAP).not.toHaveProperty('trigger');
      expect(MESSAGE_TYPE_MAP).not.toHaveProperty('wait');
      expect(MESSAGE_TYPE_MAP).not.toHaveProperty('addTag');
    });
  });

  describe('CHANNEL_FLAG_MAP', () => {
    it('maps step types to AccountChannels keys', () => {
      expect(CHANNEL_FLAG_MAP['email']).toBe('email');
      expect(CHANNEL_FLAG_MAP['webPush']).toBe('webPush');
      expect(CHANNEL_FLAG_MAP['mobilePush']).toBe('mobilePush');
      expect(CHANNEL_FLAG_MAP['sms']).toBe('sms');
      expect(CHANNEL_FLAG_MAP['whatsapp']).toBe('whatsapp');
    });

    it('maps testAB to email channel', () => {
      expect(CHANNEL_FLAG_MAP['testAB']).toBe('email');
    });

    it('maps random types to correct channels', () => {
      expect(CHANNEL_FLAG_MAP['randomMessage']).toBe('email');
      expect(CHANNEL_FLAG_MAP['randomWebPush']).toBe('webPush');
      expect(CHANNEL_FLAG_MAP['randomMobilePush']).toBe('mobilePush');
    });

    it('does not have entries for non-channel types', () => {
      expect(CHANNEL_FLAG_MAP).not.toHaveProperty('trigger');
      expect(CHANNEL_FLAG_MAP).not.toHaveProperty('wait');
      expect(CHANNEL_FLAG_MAP).not.toHaveProperty('split');
      expect(CHANNEL_FLAG_MAP).not.toHaveProperty('httpRequest');
    });
  });

  describe('layout constants', () => {
    it('NODE_SPACING is a positive number', () => {
      expect(NODE_SPACING).toBeGreaterThan(0);
      expect(NODE_SPACING).toBe(150);
    });

    it('NODE_WIDTH is a positive number', () => {
      expect(NODE_WIDTH).toBeGreaterThan(0);
      expect(NODE_WIDTH).toBe(240);
    });
  });
});
