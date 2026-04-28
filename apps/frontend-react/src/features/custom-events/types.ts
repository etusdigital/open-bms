export interface CustomEventProperty {
  type?: string;
  name?: string;
}

export interface CustomEvent {
  id: number;
  name: string;
  description?: string;
  isDefault?: boolean;
  properties?: CustomEventProperty[];
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}
