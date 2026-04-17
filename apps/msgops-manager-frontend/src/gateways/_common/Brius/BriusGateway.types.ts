export type BriusHttpParams = {
  page?: number;
  totalItems?: number;
  itemsPerPage?: number;
  totalPages?: number;
  sortBy?: string;
  order?: string;
  search?: string;
};

export type BriusHttpResponse<T> = {
  itemsPerPage: string;
  page: string;
  results: T;
  totalItems: number;
};
