import { email, minLength, required, prop } from '@rxweb/reactive-forms';

export class NewEmailForm {
  @minLength({ value: 3 })
  @required()
  subject = '';

  @required()
  ippool = '';
  priority = 'high';

  @minLength({ value: 4 })
  @required()
  @email()
  fromMail = '';

  @minLength({ value: 4 })
  @email()
  replyTo = '';

  @minLength({ value: 4 })
  @required()
  fromName = '';

  @minLength({ value: 2 })
  previewText = '';
}
