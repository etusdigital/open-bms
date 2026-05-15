import { Injectable } from '@nestjs/common';

export type DistributeTimeConditionConfig = [string, number, number, number] | [];

@Injectable()
export class DistributeTimeConditionFeature {
  getConfig(): DistributeTimeConditionConfig {
    const values = (process.env.FEATURE_DISTRIBUTE_TIME_CONDITION || '').split(':');
    if (!values.length || values[0] === '') return [];
    if (values.length != 4) return [];

    const parsedToType = values.map((value, index) => (index === 0 ? value : parseInt(value))) as DistributeTimeConditionConfig;

    return parsedToType;
  }

  shouldExecuteFeature(config: DistributeTimeConditionConfig, automation: string) {
    if (!config.length) return false;
    const [condition] = config;

    if (condition === '') return false;
    if (condition === 'ALL') return true;
    if (condition === automation) return true;

    return false;
  }

  getIncrementedMinutesValue(config: DistributeTimeConditionConfig) {
    if (!config.length) return 0;

    try {
      if (!config.length) return 0;

      const [, first, second, third] = config;
      const randomNumber = this.getRandomNumber();

      if (first >= randomNumber) return 0;

      if (randomNumber <= second && randomNumber > first) return this.timeToIncrementValue(1);

      if (randomNumber < third && randomNumber > second) return this.timeToIncrementValue(2);

      if (randomNumber >= third) return this.timeToIncrementValue(3);
    } catch {
      return 0;
    }
  }

  getRandomNumber() {
    return Math.floor(Math.random() * (100 - 0 + 1) + 0);
  }

  timeToIncrementValue(position: number) {
    if (position == null || position == undefined) return 0;
    return position * 60;
  }
}
