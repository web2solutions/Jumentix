import type { Response } from 'express';
import type { FastifyReply } from 'fastify';
import type restify from 'restify';

export type IHTTPResponse = FastifyReply | Response | restify.Response;
