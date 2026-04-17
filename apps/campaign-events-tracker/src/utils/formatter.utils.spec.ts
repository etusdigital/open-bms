import { BadRequestException } from '@nestjs/common';
import { FormatterUtils } from './formatter.utils';
import { EventTracker, MsgopsCampaignEvent, MsgopsServices, SubscriptionMessage } from '../app.interfaces';

describe('FormatterUtils', () => {
  let formatterUtils: FormatterUtils;

  beforeEach(() => {
    formatterUtils = new FormatterUtils();
  });

  describe('parseBatch', () => {
    it('should parse a valid SubscriptionMessage', () => {
      const eventTracker: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
        event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
      };

      const subscriptionMessage: SubscriptionMessage = {
        message: {
          data: Buffer.from(JSON.stringify(eventTracker)).toString('base64'),
          attributes: { key: 'test' },
          messageId: '123',
          message_id: '123',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      const result = formatterUtils.parseBatch(subscriptionMessage);
      expect(result.campaign_id).toBe(1);
      expect(result.event).toBe(MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED);
    });

    it('should throw BadRequestException for invalid base64 data', () => {
      const subscriptionMessage: SubscriptionMessage = {
        message: {
          data: 'not-valid-json-even-after-base64',
          attributes: { key: 'test' },
          messageId: '123',
          message_id: '123',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // The data decodes to garbage, so JSON.parse will fail
      expect(() => formatterUtils.parseBatch(subscriptionMessage)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for completely invalid data', () => {
      const subscriptionMessage: SubscriptionMessage = {
        message: {
          data: Buffer.from('not json').toString('base64'),
          attributes: { key: 'test' },
          messageId: '123',
          message_id: '123',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      expect(() => formatterUtils.parseBatch(subscriptionMessage)).toThrow(BadRequestException);
    });
  });
});
