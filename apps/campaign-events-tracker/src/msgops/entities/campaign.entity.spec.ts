import { CampaignEntity } from './campaign.entity';
import { CampaignsType } from '../../app.interfaces';

describe('CampaignEntity', () => {
  it('should create an instance', () => {
    const entity = new CampaignEntity();
    expect(entity).toBeDefined();
  });

  describe('afterload', () => {
    it('should transform recurrenceSettings for recurring campaigns', () => {
      const entity = new CampaignEntity();
      entity.type = CampaignsType.RECURRING;
      entity.recurrenceSettings = {
        date: '2026-03-01T10:00:00Z' as any,
        interval: '1' as any,
        frequency: 1,
        weekDays: [1, 3],
        hasExpiration: 1 as any,
        untilDate: '2026-04-01T10:00:00Z' as any,
        untilSend: '5' as any,
        firstSentDate: '2026-03-01T10:00:00Z' as any,
        lastSentDate: '2026-03-10T10:00:00Z' as any,
      };

      entity.afterload();

      expect(entity.recurrenceSettings.date).toBeInstanceOf(Date);
      expect(entity.recurrenceSettings.interval).toBe(1);
      expect(entity.recurrenceSettings.hasExpiration).toBe(true);
      expect(entity.recurrenceSettings.untilDate).toBeInstanceOf(Date);
      expect(entity.recurrenceSettings.untilSend).toBe(5);
      expect(entity.recurrenceSettings.firstSentDate).toBeInstanceOf(Date);
      expect(entity.recurrenceSettings.lastSentDate).toBeInstanceOf(Date);
    });

    it('should handle null untilDate, untilSend, firstSentDate, lastSentDate', () => {
      const entity = new CampaignEntity();
      entity.type = CampaignsType.RECURRING;
      entity.recurrenceSettings = {
        date: '2026-03-01T10:00:00Z' as any,
        interval: '1' as any,
        frequency: 1,
        weekDays: [1, 3],
        hasExpiration: 0 as any,
        untilDate: null as any,
        untilSend: null as any,
        firstSentDate: null as any,
        lastSentDate: null as any,
      };

      entity.afterload();

      expect(entity.recurrenceSettings.untilDate).toBeNull();
      expect(entity.recurrenceSettings.untilSend).toBeNull();
      expect(entity.recurrenceSettings.firstSentDate).toBeNull();
      expect(entity.recurrenceSettings.lastSentDate).toBeNull();
      expect(entity.recurrenceSettings.hasExpiration).toBe(false);
    });

    it('should not transform for non-recurring campaigns', () => {
      const entity = new CampaignEntity();
      entity.type = CampaignsType.SIMPLE;
      entity.recurrenceSettings = {
        date: '2026-03-01T10:00:00Z' as any,
        interval: '1' as any,
        frequency: 1,
        weekDays: [],
        hasExpiration: false,
        untilDate: null as any,
        untilSend: null as any,
      };

      entity.afterload();

      // Should remain as string since afterload only runs for RECURRING
      expect(typeof entity.recurrenceSettings.date).toBe('string');
    });
  });
});
