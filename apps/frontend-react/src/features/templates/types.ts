export interface Template {
  id: number;
  name: string;
  description?: string;
  html_template?: string;
  json_template?: string;
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}
