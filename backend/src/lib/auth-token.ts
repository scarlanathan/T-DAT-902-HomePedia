import { sign, verify, type SignOptions } from 'jsonwebtoken';

export const AUTH_COOKIE_NAME = 'homepedia_session';

export type JwtPayload = {
  sub: string;
  email: string;
};

export function signAuthToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string,
): string {
  return sign(payload, secret, { expiresIn } as SignOptions);
}

export function verifyAuthToken(token: string, secret: string): JwtPayload {
  const decoded = verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  const sub = 'sub' in decoded ? decoded.sub : undefined;
  const email = 'email' in decoded ? decoded.email : undefined;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub, email };
}
