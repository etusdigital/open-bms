import { BmsHttpParams } from './BmsGateway.types';

export const bmsHttpParamsDefault: BmsHttpParams = {
  page: 1,
  totalItems: undefined,
  itemsPerPage: 10,
  totalPages: undefined,
  search: '',
};

export const getBmsHttpParamsToString = (params: BmsHttpParams) => {
  const { itemsPerPage, page, search, sortBy, order, totalPages, totalItems } = params;
  let urlParams = '';

  if (page !== undefined || page !== null) {
    urlParams += `page=${page}`;
  }

  if (itemsPerPage === 0 || itemsPerPage) {
    urlParams += `&itemsPerPage=${itemsPerPage}`;
  }

  if (totalPages === 0 || totalPages) {
    urlParams += `&totalPages=${totalPages}`;
  }

  if (totalItems === 0 || totalItems) {
    urlParams += `&totalItems=${totalItems}`;
  }

  if (search) {
    urlParams += `&search=${search}`;
  }

  if (sortBy) {
    urlParams += `&sortBy=${sortBy}`;
  }

  if (order) {
    urlParams += `&order=${order}`;
  }

  return urlParams;
};
