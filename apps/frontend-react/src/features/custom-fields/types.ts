export interface CustomField {
  id: number;
  title: string;
  name: string;
  description?: string;
  type?: string | null;
  order?: number;
  accountId?: number;
  label?: string | null;
  placeholder?: string | null;
  fieldFormat?: string | null;
  fileFormats?: string[] | null;
  characterLimit?: number | null;
  decimalLength?: number | null;
  options?: string[] | null;
  mask?: string | null;
  attributionType?: string | null;
  fieldType?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
