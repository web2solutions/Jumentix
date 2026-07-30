import type { Request } from 'express';
import type restify from 'restify';
import type { FastifyRequest } from 'fastify';

export type IHTTPRequest = FastifyRequest | Request | restify.Request;
