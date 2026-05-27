import { DistributeTimeConditionFeature } from './distribute-time-condition.feature';

describe('DistributeTimeCondition', () => {
  let feature: DistributeTimeConditionFeature;

  beforeEach(() => {
    feature = new DistributeTimeConditionFeature();
  });

  describe('Function: timeToIncrementValue', () => {
    it('should return 60 in position equal 1', () => {
      expect(feature.timeToIncrementValue(1)).toBe(60);
    });

    it('should return 120 in position equal 2', () => {
      expect(feature.timeToIncrementValue(2)).toBe(120);
    });

    it('should return 180 in position equal 3', () => {
      expect(feature.timeToIncrementValue(3)).toBe(180);
    });

    it('should return 0 in position is null', () => {
      expect(feature.timeToIncrementValue(null)).toBe(0);
    });

    it('should return 0 in position is undefined', () => {
      expect(feature.timeToIncrementValue(undefined)).toBe(0);
    });
  });

  describe('Function: getConfig', () => {
    it('should array empty', () => {
      expect(feature.getConfig()).toHaveLength(0);
    });

    it('should return properties to config correctly (condition, firstPercent, secondPercent, thirdPercent)', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';
      const [condition, first, second, third] = feature.getConfig();

      expect(condition).toBe('ALL');
      expect(first).toBe(15);
      expect(second).toBe(45);
      expect(third).toBe(70);
    });

    it('should return empty properties to config', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45';
      const config = feature.getConfig();
      expect(config).toHaveLength(0);
    });
  });

  describe('Function: shouldExecuteFeature', () => {
    it('should return false withou env var', () => {
      delete process.env.FEATURE_DISTRIBUTE_TIME_CONDITION;
      const config = feature.getConfig();

      expect(feature.shouldExecuteFeature(config, '')).toBe(false);
    });

    it('should return false without env var', () => {
      delete process.env.FEATURE_DISTRIBUTE_TIME_CONDITION;
      const config = feature.getConfig();

      expect(feature.shouldExecuteFeature(config, '')).toBe(false);
    });
    it('should return false with incomplete env', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45';
      const config = feature.getConfig();

      expect(feature.shouldExecuteFeature(config, 'ALL')).toBe(false);
    });
    it('should return true with complete env', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';
      const config = feature.getConfig();
      expect(feature.shouldExecuteFeature(config, '')).toBe(true);
    });
    it('should return true with automation_id is same', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'vq-unico:15:45:70';
      const config = feature.getConfig();
      expect(feature.shouldExecuteFeature(config, 'vq-unico')).toBe(true);
    });
    it('should return false with automation_id is different', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'vq-unico-outros:15:45:70';
      const config = feature.getConfig();
      expect(feature.shouldExecuteFeature(config, 'vq-unico')).toBe(false);
    });

    it('should return true with automation_id is different but env is all', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';
      const config = feature.getConfig();
      expect(feature.shouldExecuteFeature(config, 'vq-unico')).toBe(true);
    });
  });

  describe('Implement Solution', () => {
    it('should return 0 because test env is ALL:15:45:70 and random number is 10', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 10;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(0);
    });
    it('should return 0 because test env is ALL:15:45:70 and random number is 15', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 15;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(0);
    });
    it('should return 60 because test env is ALL:15:45:70 and random number is 16', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 16;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(60);
    });
    it('should return 120 because test env is ALL:15:45:70 and random number is 46', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 46;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(120);
    });
    it('should return 120 because test env is ALL:15:45:70 and random number is 69', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 69;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(120);
    });
    it('should return 180 because test env is ALL:15:45:70 and random number is 70', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 70;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(180);
    });
    it('should return 180 because test env is ALL:15:45:70 and random number is 90', () => {
      process.env.FEATURE_DISTRIBUTE_TIME_CONDITION = 'ALL:15:45:70';

      let waitFor = 0;

      const config = feature.getConfig();

      if (feature.shouldExecuteFeature(config, 'automation-title')) {
        feature.getRandomNumber = () => 90;
        waitFor = waitFor + feature.getIncrementedMinutesValue(config);
      }

      expect(waitFor).toBe(180);
    });
  });
});
