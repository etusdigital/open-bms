import { email, minLength, required } from '@rxweb/reactive-forms';

export class SendEmailForm {
  @minLength({ value: 3 })
  @required()
  name = '';

  @required()
  @email()
  email = '';
}
