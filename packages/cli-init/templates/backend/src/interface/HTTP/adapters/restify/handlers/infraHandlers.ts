import apiDocGetHandlerFactory from '@src/interface/HTTP/adapters/restify/handlers/apiDocGetHandlerFactory';
import apiVersionsGetHandlerFactory from '@src/interface/HTTP/adapters/restify/handlers/apiversions.get';
import localhostGetHandlerFactory from '@src/interface/HTTP/adapters/restify/handlers/localhost.get';

const infraHandlers = {
  localhostGetHandlerFactory,
  apiVersionsGetHandlerFactory,
  apiDocGetHandlerFactory
};

export default infraHandlers;
