export interface SuperAdminAccount {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  isInternal: boolean;
  createdAt: string;
  updatedAt?: string;
}
