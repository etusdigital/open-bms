export class PushTemplates {
  default: object;
  defaultRight: object;
  bar: object;
  native: object;

  constructor(pushTemplates: PushTemplates = {} as PushTemplates) {
    this.default = pushTemplates.default;
    this.defaultRight = pushTemplates.defaultRight;
    this.bar = pushTemplates.bar;
    this.native = pushTemplates.native;
  }
}
