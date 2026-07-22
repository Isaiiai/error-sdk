import { Request, Response } from 'express';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function success<T>(res: Response, data: T, status = 200, extra?: Record<string, unknown>) {
  return res.status(status).json({ success: true, data, ...extra });
}

export function created<T>(res: Response, data: T, extra?: Record<string, unknown>) {
  return success(res, data, 201, extra);
}

export function fail(res: Response, status: number, code: string, message: string, details?: unknown) {
  const error: ApiError = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}

export function getPagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}
