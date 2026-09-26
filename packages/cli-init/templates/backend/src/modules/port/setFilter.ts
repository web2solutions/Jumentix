import type BaseDomainEvent from '@src/modules/port/BaseDomainEvent';

const setFilter = (event: BaseDomainEvent): Record<any, any> => {
  let filter: Record<any, any> = {};
  if (event.queryString?.filter) {
    const decodedFilterString = Buffer.from(event.queryString?.filter, 'base64').toString();
    let decodedFilter;
    try {
      decodedFilter = JSON.parse(decodedFilterString);
    } catch (error) {
      decodedFilter = {};
    }
    filter = { ...decodedFilter };
  }
  return filter;
};

export default setFilter;
