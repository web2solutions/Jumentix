import apiDocGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/apiDocGetHandlerFactory';
import apiVersionsGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/apiversions.get';
import localhostGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/localhost.get';

const infraHandlers = {
  localhostGetHandlerFactory,
  apiVersionsGetHandlerFactory,
  apiDocGetHandlerFactory
};

export default infraHandlers;
