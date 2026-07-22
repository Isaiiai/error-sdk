import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { fail } from '../utils/response';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid request body', result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Error]', err);
  if (err.name === 'ValidationError') {
    return fail(res, 400, 'VALIDATION_ERROR', err.message);
  }
  if ((err as { code?: number }).code === 11000) {
    return fail(res, 409, 'DUPLICATE', 'Resource already exists');
  }
  return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
