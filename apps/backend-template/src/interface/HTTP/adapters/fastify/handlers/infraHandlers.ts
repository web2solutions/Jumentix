import apiDocGetHandlerFactory from '@src/interface/HTTP/adapters/fastify/handlers/apiDocGetHandlerFactory';
import apiVersionsGetHandlerFactory from '@src/interface/HTTP/adapters/fastify/handlers/apiversions.get';
import localhostGetHandlerFactory from '@src/interface/HTTP/adapters/fastify/handlers/localhost.get';

const infraHandlers = {
  localhostGetHandlerFactory,
  apiVersionsGetHandlerFactory,
  apiDocGetHandlerFactory
};

export default infraHandlers;
