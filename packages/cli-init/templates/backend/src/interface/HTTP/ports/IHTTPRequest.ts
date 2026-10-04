import type { Request } from 'express';
import type { FastifyRequest } from 'fastify';
import type restify from 'restify';

export type IHTTPRequest = FastifyRequest | Request | restify.Request;
