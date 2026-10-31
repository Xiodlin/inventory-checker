import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ error: 'Invalid request', details: error.issues.map(i => ({ path: i.path, message: i.message })) }); return; }
  if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ error: 'Invalid JSON' }); return; }
  if ((error as { type?: string }).type === 'entity.too.large') { res.status(413).json({ error: 'Request too large' }); return; }
  console.error('API request failed', (error as { code?: string }).code ?? 'internal');
  res.status(500).json({ error: 'Internal server error' });
};
