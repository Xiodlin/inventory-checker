import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';

const derive = promisify(scrypt);
const issuer = 'inventory-checker';
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hex] = encoded.split(':');
  if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const actual = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}
export function issueToken(userId: string, secret: string) {
  return jwt.sign({}, secret, { subject: userId, issuer, audience: issuer, algorithm: 'HS256', expiresIn: '7d' });
}
export function verifyToken(token: string, secret: string) {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience: issuer });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.sub)) throw new Error('Invalid token');
  return { userId: payload.sub, expiresAt: (payload.exp ?? 0) * 1000 };
}
export function authenticate(secret: string): RequestHandler {
  return (req, res, next) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Authentication required' }); return; }
    try {
      res.locals.userId = verifyToken(header.slice(7), secret).userId;
      next();
    } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
  };
}
