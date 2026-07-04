import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DbService } from '../../src/modules/db/db.service';
import { AUTH_COOKIE_NAME } from '../../src/lib/auth-token';

type AppUserRow = {
  id: string;
  email: string;
  display_name: string;
  locale: 'en' | 'fr';
  theme: 'light' | 'dark';
  password_hash: string;
};

class AuthE2eDb {
  private users = new Map<string, AppUserRow>();
  private emailToId = new Map<string, string>();
  private nextId = 1;

  async ping(): Promise<boolean> {
    return true;
  }

  async query(text: string, params?: unknown[]) {
    if (text.includes('CREATE TABLE IF NOT EXISTS app_user')) {
      return { rows: [] };
    }

    if (text.includes('INSERT INTO app_user')) {
      const [email, passwordHash, displayName, locale, theme] = params as [
        string,
        string,
        string,
        'en' | 'fr',
        'light' | 'dark',
      ];
      if (this.emailToId.has(email)) {
        const err = Object.assign(new Error('duplicate key'), { code: '23505' });
        throw err;
      }
      const id = `user-${this.nextId++}`;
      const row: AppUserRow = {
        id,
        email,
        display_name: displayName,
        locale,
        theme,
        password_hash: passwordHash,
      };
      this.users.set(id, row);
      this.emailToId.set(email, id);
      return {
        rows: [
          {
            id: row.id,
            email: row.email,
            display_name: row.display_name,
            locale: row.locale,
            theme: row.theme,
          },
        ],
      };
    }

    if (text.includes('password_hash') && text.includes('WHERE email = $1')) {
      const email = params?.[0] as string;
      const id = this.emailToId.get(email);
      return { rows: id ? [this.users.get(id)!] : [] };
    }

    if (text.includes('FROM app_user') && text.includes('WHERE id = $1')) {
      const id = params?.[0] as string;
      const row = this.users.get(id);
      return {
        rows: row
          ? [
              {
                id: row.id,
                email: row.email,
                display_name: row.display_name,
                locale: row.locale,
                theme: row.theme,
              },
            ]
          : [],
      };
    }

    if (text.includes('UPDATE app_user')) {
      const [id, locale, theme] = params as [
        string,
        'en' | 'fr' | null,
        'light' | 'dark' | null,
      ];
      const row = this.users.get(id);
      if (!row) return { rows: [] };
      if (locale) row.locale = locale;
      if (theme) row.theme = theme;
      return {
        rows: [
          {
            id: row.id,
            email: row.email,
            display_name: row.display_name,
            locale: row.locale,
            theme: row.theme,
          },
        ],
      };
    }

    return { rows: [] };
  }
}

describe('Auth API e2e', () => {
  let app: INestApplication;
  let db: AuthE2eDb;

  beforeAll(async () => {
    db = new AuthE2eDb();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue(db)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register creates account and sets session cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/auth/register')
      .send({
        email: 'jane@example.com',
        password: 'password123',
        display_name: 'jane',
        locale: 'fr',
        theme: 'dark',
      })
      .expect(201);

    expect(res.body.email).toBe('jane@example.com');
    expect(res.body.locale).toBe('fr');
    expect(res.body.theme).toBe('dark');
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain(`${AUTH_COOKIE_NAME}=`);
  });

  it('POST /auth/register rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' })
      .expect(409);
  });

  it('POST /auth/login rejects invalid credentials', async () => {
    const hash = await bcrypt.hash('password123', 10);
    await db.query(
      `
      INSERT INTO app_user (email, password_hash, display_name, locale, theme)
      VALUES ($1, $2, $3, $4, $5)
      `,
      ['login@example.com', hash, 'login', 'en', 'light'],
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password: 'password123' })
      .expect(401);
  });

  it('GET /auth/me requires authentication', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('login, me, settings update, and logout flow works', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        email: 'flow@example.com',
        password: 'password123',
        locale: 'en',
        theme: 'light',
      })
      .expect(201);

    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.email).toBe('flow@example.com');

    const updated = await agent
      .patch('/auth/me/settings')
      .send({ locale: 'fr', theme: 'dark' })
      .expect(200);
    expect(updated.body.locale).toBe('fr');
    expect(updated.body.theme).toBe('dark');

    await agent.post('/auth/logout').expect(201);
    await agent.get('/auth/me').expect(401);
  });
});
