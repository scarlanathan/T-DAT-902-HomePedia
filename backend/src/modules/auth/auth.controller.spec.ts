import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

function makeModule(svc: Record<string, jest.Mock>) {
  return Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: svc }],
  })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: jest.fn(async () => true) })
    .compile();
}

describe('AuthController', () => {
  it('parses register body and sets cookie', async () => {
    const moduleRef = await makeModule({
      register: jest.fn(async () => ({
        user: {
          id: 'user-1',
          email: 'jane@example.com',
          displayName: 'jane',
          locale: 'en',
          theme: 'light',
        },
        token: 'token-123',
      })),
    });
    const ctrl = moduleRef.get(AuthController);
    const svc = moduleRef.get(AuthService) as any;
    const res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const out = await ctrl.register(
      {
        email: 'jane@example.com',
        password: 'password123',
        display_name: 'jane',
      },
      res as any,
    );

    expect(svc.register).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
      displayName: 'jane',
      locale: undefined,
      theme: undefined,
    });
    expect(res.cookie).toHaveBeenCalled();
    expect(out.email).toBe('jane@example.com');
  });

  it('parses login body', async () => {
    const moduleRef = await makeModule({
      login: jest.fn(async () => ({
        user: {
          id: 'user-1',
          email: 'jane@example.com',
          displayName: 'jane',
          locale: 'en',
          theme: 'light',
        },
        token: 'token-123',
      })),
    });
    const ctrl = moduleRef.get(AuthController);
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };

    await ctrl.login(
      { email: 'jane@example.com', password: 'secret' },
      res as any,
    );

    expect(res.cookie).toHaveBeenCalled();
  });

  it('clears cookie on logout', async () => {
    const moduleRef = await makeModule({});
    const ctrl = moduleRef.get(AuthController);
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };

    const out = await ctrl.logout(res as any);

    expect(res.clearCookie).toHaveBeenCalled();
    expect(out).toEqual({ ok: true });
  });

  it('returns current user from me', async () => {
    const moduleRef = await makeModule({});
    const ctrl = moduleRef.get(AuthController);
    const user = {
      id: 'user-1',
      email: 'jane@example.com',
      displayName: 'jane',
      locale: 'en' as const,
      theme: 'light' as const,
      preferences: null,
      onboarded: false,
    };

    await expect(ctrl.me(user)).resolves.toEqual(user);
  });

  it('updates settings for authenticated user', async () => {
    const moduleRef = await makeModule({
      updateSettings: jest.fn(async () => ({
        id: 'user-1',
        email: 'jane@example.com',
        displayName: 'jane',
        locale: 'fr',
        theme: 'dark',
      })),
    });
    const ctrl = moduleRef.get(AuthController);
    const svc = moduleRef.get(AuthService) as any;

    const out = await ctrl.updateSettings(
      { id: 'user-1' },
      { locale: 'fr', theme: 'dark' },
    );

    expect(svc.updateSettings).toHaveBeenCalledWith('user-1', {
      locale: 'fr',
      theme: 'dark',
    });
    expect(out.theme).toBe('dark');
  });
});
