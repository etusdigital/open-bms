export interface TagBatch {
  action: 'add' | 'remove';
  tag: string;
  accountId?: number;
  tagId?: number;
  apiKey: string;
  createContacts: boolean;
  contacts: ContactBatch[];
}

export interface ContactBatch {
  contacts: Array<string>;
  headers: any;
  tags: Array<string>;
  actions: Array<string>;
}
