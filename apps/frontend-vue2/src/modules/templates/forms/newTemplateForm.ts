import { minLength, required } from '@rxweb/reactive-forms';

export class NewTemplateForm {
  @required()
  name = '';
}
