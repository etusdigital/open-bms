import { email, minLength, required } from '@rxweb/reactive-forms';

export class EmailForm {
  @minLength({ value: 3 })
  @required()
  subject = '';

  @minLength({ value: 4 })
  @email()
  fromMail = '';

  @minLength({ value: 4 })
  @email()
  replyTo = '';

  @minLength({ value: 4 })
  fromName = '';

  @minLength({ value: 2 })
  previewText = '';
}
