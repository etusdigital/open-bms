import { EmailPriority, SendEmailMessage } from '../interfaces';
import { EmailPullSenderFeature } from './email-pull-sender.feature';

describe('EmailPullSenderFeature', () => {
  let emailPullSenderFeature: EmailPullSenderFeature;

  beforeEach(() => {
    emailPullSenderFeature = new EmailPullSenderFeature();
  });

  describe('Function: isActive', () => {
    it('should return false because env is undefined', () => {
      expect(emailPullSenderFeature.isActive()).toBeFalsy();
    });

    it('should return false because env is not filled', () => {
      process.env.FEATURE_EMAIL_PULL_SENDER = '';
      expect(emailPullSenderFeature.isActive()).toBeFalsy();
    });

    it('should return true because env is filled', () => {
      process.env.FEATURE_EMAIL_PULL_SENDER = 'qh-f24h-via-plusdin';
      expect(emailPullSenderFeature.isActive()).toBeTruthy();
    });

    it('should return true because env is ALL', () => {
      process.env.FEATURE_EMAIL_PULL_SENDER = 'ALL';
      expect(emailPullSenderFeature.isActive()).toBeTruthy();
    });
  });

  describe('Function: checkProcess', () => {
    it('should return true because env is ALL', () => {
      process.env.FEATURE_EMAIL_PULL_SENDER = 'ALL';
      expect(emailPullSenderFeature.checkProcess('')).toBeTruthy();
      expect(emailPullSenderFeature.checkProcess('vh-unico')).toBeTruthy();
    });

    it('should return true because env is same', () => {
      process.env.FEATURE_EMAIL_PULL_SENDER = 'vh-unico';
      expect(emailPullSenderFeature.checkProcess('')).toBeFalsy();
      expect(emailPullSenderFeature.checkProcess('vh-unico')).toBeTruthy();
    });

    it('should return true because env is null', () => {
      delete process.env.FEATURE_EMAIL_PULL_SENDER;
      expect(emailPullSenderFeature.checkProcess('')).toBeFalsy();
      expect(emailPullSenderFeature.checkProcess('vh-unico')).toBeFalsy();
    });
  });

  describe('Function: sendEmailMessageConfig', () => {
    it('should return true because env is ALL', () => {
      process.env.FEATURE_EMAIL_PULL_SENDER = 'ALL';
      process.env.TOPIC_FEATURE_EMAIL_PULL_SENDER = 'TOPIC_TESTE';

      const sendEmailTest = {
        automationName: 'automation-test',
        message: { priority: EmailPriority.HIGH },
      } as SendEmailMessage;

      const config = emailPullSenderFeature.sendEmailMessageConfig(sendEmailTest);

      expect(config.topic).toBe('TOPIC_TESTE');
      expect(config.message.automationName).toBe('automation-test');
      expect(config.attrs.priority).toBe('high');
      expect(config.attrs.type).toBe('pull-sender');
    });
  });
});
