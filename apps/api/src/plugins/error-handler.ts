import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@avenza/shared';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      request.log.error(error);

      if (error instanceof ZodError) {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.flatten(),
          },
        };
        return reply.status(400).send(response);
      }

      const statusCode =
        'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
      const errorCode =
        'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_SERVER_ERROR';

      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: errorCode,
          message: statusCode >= 500 ? 'Internal Server Error' : error.message,
        },
      };

      return reply.status(statusCode).send(response);
    }
  );
}
