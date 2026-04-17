import { required } from '@rxweb/reactive-forms';

export class NewPoolForm {
  @required()
  name = '';
  pool_name = '';
  ip = [];
  account_id = [];
}
