import { AuthService } from './auth.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

describe('AuthService', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_EXPIRES_IN') return '7d';
      return fallback;
    }),
  };

  it('registers a user and returns a token', async () => {
    const db = mockDb([
      {
        id: 'user-1',
        email: 'jane@example.com',
        display_name: 'jane',
        locale: 'en',
        theme: 'light',
      },
    ]);
    const svc = new AuthService(db as any, config as any);
    const out = await svc.register({
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(out.user.email).toBe('jane@example.com');
    expect(out.token).toBeTruthy();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app_user'),
      expect.arrayContaining(['jane@example.com']),
    );
  });

  it('logs in with valid credentials', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('password123', 10);
    const db = mockDb([
      {
        id: 'user-1',
        email: 'jane@example.com',
        display_name: 'jane',
        locale: 'fr',
        theme: 'dark',
        password_hash: hash,
      },
    ]);
    const svc = new AuthService(db as any, config as any);
    const out = await svc.login({
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(out.user.locale).toBe('fr');
    expect(out.token).toBeTruthy();
  });

  it('updates user settings', async () => {
    const db = mockDb([
      {
        id: 'user-1',
        email: 'jane@example.com',
        display_name: 'jane',
        locale: 'fr',
        theme: 'dark',
      },
    ]);
    const svc = new AuthService(db as any, config as any);
    const out = await svc.updateSettings('user-1', { locale: 'fr', theme: 'dark' });

    expect(out.theme).toBe('dark');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE app_user'),
      ['user-1', 'fr', 'dark'],
    );
  });

  it('rejects login when user is unknown', async () => {
    const db = mockDb([]);
    const svc = new AuthService(db as any, config as any);

    await expect(
      svc.login({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects login when password is wrong', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-password', 10);
    const db = mockDb([
      {
        id: 'user-1',
        email: 'jane@example.com',
        display_name: 'jane',
        locale: 'en',
        theme: 'light',
        password_hash: hash,
      },
    ]);
    const svc = new AuthService(db as any, config as any);

    await expect(
      svc.login({ email: 'jane@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects duplicate email on register', async () => {
    const db = mockDb([]);
    (db.query as jest.Mock).mockImplementation(async (text: string) => {
      if (text.includes('INSERT INTO app_user')) {
        const err = Object.assign(new Error('duplicate key'), { code: '23505' });
        throw err;
      }
      return { rows: [] };
    });
    const svc = new AuthService(db as any, config as any);

    await expect(
      svc.register({ email: 'jane@example.com', password: 'password123' }),
    ).rejects.toThrow('Email already registered');
  });

  it('returns null when user id is missing', async () => {
    const db = mockDb([]);
    const svc = new AuthService(db as any, config as any);

    await expect(svc.findUserById('missing')).resolves.toBeNull();
  });
});
