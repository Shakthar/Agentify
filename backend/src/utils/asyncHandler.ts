import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Envolve um handler async para encaminhar erros ao errorHandler,
 * eliminando try/catch repetidos em cada rota.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
