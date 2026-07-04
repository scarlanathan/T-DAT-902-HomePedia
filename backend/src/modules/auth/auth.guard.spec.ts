import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { signAuthToken, AUTH_COOKIE_NAME } from '../../lib/auth-token';
import { AuthGuard } from './auth.guard';
import type { PublicUser } from './auth.service';

function mockContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe('AuthGuard', () => {
  const secret = 'test-secret';
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'JWT_SECRET' ? secret : fallback,
    ),
  };

  const publicUser: PublicUser = {
    id: 'user-1',
    email: 'jane@example.com',
    displayName: 'jane',
    locale: 'en',
    theme: 'light',
    preferences: null,
    onboarded: false,
  };

  it('rejects when session cookie is missing', async () => {
    const auth = { findUserById: jest.fn() };
    const guard = new AuthGuard(auth as any, config as any);

    await expect(
      guard.canActivate(mockContext({ cookies: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when token is invalid', async () => {
    const auth = { findUserById: jest.fn() };
    const guard = new AuthGuard(auth as any, config as any);

    await expect(
      guard.canActivate(
        mockContext({ cookies: { [AUTH_COOKIE_NAME]: 'not-a-valid-token' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('attaches user when token and account are valid', async () => {
    const token = signAuthToken(
      { sub: publicUser.id, email: publicUser.email },
      secret,
      '7d',
    );
    const req = { cookies: { [AUTH_COOKIE_NAME]: token } };
    const findUserById = jest.fn(async () => publicUser);
    const guard = new AuthGuard({ findUserById } as any, config as any);

    await expect(guard.canActivate(mockContext(req))).resolves.toBe(true);
    expect(findUserById).toHaveBeenCalledWith(publicUser.id);
    expect(req).toMatchObject({ user: publicUser });
  });
});
