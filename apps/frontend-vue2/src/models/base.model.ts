export class BaseModel {
  id: number;
  name: string;
  description: string;
  // account_id: string;
  // api_key: string;
  // type: string;
  // quiz_type: string;
  // account_limit: number;
  // current_size: number;
  // created_at: Date;
  // updated_at:  Date;
  // source: string;
  // tag_newsletter: string;
  // tag_reengage: string;
  // default_list: string;
  // fields: string

  constructor(
    id: number,
    name: string,
    description: string
    //  account_id: string
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    // this.account_id = account_id;
  }
}
