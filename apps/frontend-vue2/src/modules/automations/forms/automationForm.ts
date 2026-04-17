import { minLength, required, prop, alpha } from '@rxweb/reactive-forms';

export class AutomationForm {
  @minLength({ value: 3 })
  @required()
  title = '';

  @prop()
  tag = '';

  @prop()
  list = null;

  @required()
  message = null;

  @required()
  isActive = false;
}
