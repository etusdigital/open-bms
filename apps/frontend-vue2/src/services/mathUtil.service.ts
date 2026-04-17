import { injectable } from 'vue-typescript-inject';

export default class MathUtilService {
  percentage(totalValue: number, partialValue: number) {
    return (100 * partialValue) / totalValue;
  }
}
