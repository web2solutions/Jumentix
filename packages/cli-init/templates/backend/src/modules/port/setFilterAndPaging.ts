import { DEFAULT_PAGE_SIZE } from '@src/config/constants';

import type BaseDomainEvent from '@src/modules/port/BaseDomainEvent';

import type { IPagingRequest } from './IPagingRequest';

const setFilterAndPaging = (event: BaseDomainEvent): (Record<any, any> | IPagingRequest)[] => {
  let filter: Record<string, string | number> = {};
  const paging: IPagingRequest = {
    page: 1,
    size: DEFAULT_PAGE_SIZE
  };
  if (event.queryString?.page) {
    if (!Number.isNaN(event.queryString.page)) {
      paging.page = +event.queryString.page;
    }
  }
  if (event.queryString?.size) {
    if (!Number.isNaN(event.queryString.size)) {
      paging.size = +event.queryString.size;
    }
  }
  if (event.queryString?.filter) {
    filter = { ...JSON.parse(event.queryString.filter) };
  }
  return [filter, paging];
};

export default setFilterAndPaging;
