import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../db/db.service';
import { signAuthToken } from '../../lib/auth-token';

const APP_USER_SCHEMA = `
CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr')),
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user (email);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS preferences JSONB;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE;
`;

// Housing-search preferences persisted per user (drive personal borrowing
// capacity and score weighting). Stored as a JSONB blob on app_user.
export type SearchPreferences = {
  incomeMonthlyEur: number | null;
  downPaymentEur: number | null;
  maxDti: number;
  termYears: number;
  propertyType: '' | 'Appartement' | 'Maison';
  weights: { price: number; social: number; quality: number };
};

const USER_COLUMNS =
  'id, email, display_name, locale, theme, preferences, onboarded';

export type AppUserRow = {
  id: string;
  email: string;
  display_name: string;
  locale: 'en' | 'fr';
  theme: 'light' | 'dark';
  preferences: SearchPreferences | null;
  onboarded: boolean | null;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  locale: 'en' | 'fr';
  theme: 'light' | 'dark';
  preferences: SearchPreferences | null;
  onboarded: boolean;
};

const BCRYPT_ROUNDS = 10;

function toPublicUser(row: AppUserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    locale: row.locale,
    theme: row.theme,
    preferences: row.preferences ?? null,
    onboarded: row.onboarded ?? false,
  };
}

function defaultDisplayName(email: string): string {
  return email.split('@')[0] || 'User';
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    await this.db.query(APP_USER_SCHEMA);
  }

  private jwtSecret(): string {
    return this.config.get<string>('JWT_SECRET', 'dev-only-change-me');
  }

  private jwtExpiresIn(): string {
    return this.config.get<string>('JWT_EXPIRES_IN', '7d');
  }

  createToken(user: PublicUser): string {
    return signAuthToken(
      { sub: user.id, email: user.email },
      this.jwtSecret(),
      this.jwtExpiresIn(),
    );
  }

  async register(params: {
    email: string;
    password: string;
    displayName?: string;
    locale?: 'en' | 'fr';
    theme?: 'light' | 'dark';
  }): Promise<{ user: PublicUser; token: string }> {
    const email = params.email.trim().toLowerCase();
    const displayName = params.displayName?.trim() || defaultDisplayName(email);
    const locale = params.locale ?? 'en';
    const theme = params.theme ?? 'light';
    const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);

    try {
      const res = await this.db.query<AppUserRow>(
        `
        INSERT INTO app_user (email, password_hash, display_name, locale, theme)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${USER_COLUMNS}
        `,
        [email, passwordHash, displayName, locale, theme],
      );
      const user = toPublicUser(res.rows[0]);
      return { user, token: this.createToken(user) };
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(params: {
    email: string;
    password: string;
  }): Promise<{ user: PublicUser; token: string }> {
    const email = params.email.trim().toLowerCase();
    const res = await this.db.query<AppUserRow & { password_hash: string }>(
      `
      SELECT ${USER_COLUMNS}, password_hash
      FROM app_user
      WHERE email = $1
      `,
      [email],
    );
    const row = res.rows[0];
    if (!row) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(params.password, row.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const user = toPublicUser(row);
    return { user, token: this.createToken(user) };
  }

  async findUserById(id: string): Promise<PublicUser | null> {
    const res = await this.db.query<AppUserRow>(
      `
      SELECT ${USER_COLUMNS}
      FROM app_user
      WHERE id = $1
      `,
      [id],
    );
    return res.rows[0] ? toPublicUser(res.rows[0]) : null;
  }

  async updateSettings(
    userId: string,
    params: { locale?: 'en' | 'fr'; theme?: 'light' | 'dark' },
  ): Promise<PublicUser> {
    const locale = params.locale;
    const theme = params.theme;
    if (!locale && !theme) {
      const existing = await this.findUserById(userId);
      if (!existing) throw new UnauthorizedException('User not found');
      return existing;
    }

    const res = await this.db.query<AppUserRow>(
      `
      UPDATE app_user
      SET
        locale = COALESCE($2, locale),
        theme = COALESCE($3, theme),
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${USER_COLUMNS}
      `,
      [userId, locale ?? null, theme ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new UnauthorizedException('User not found');
    return toPublicUser(row);
  }

  async savePreferences(
    userId: string,
    preferences: SearchPreferences,
  ): Promise<PublicUser> {
    const res = await this.db.query<AppUserRow>(
      `
      UPDATE app_user
      SET preferences = $2::jsonb,
          onboarded = TRUE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING ${USER_COLUMNS}
      `,
      [userId, JSON.stringify(preferences)],
    );
    const row = res.rows[0];
    if (!row) throw new UnauthorizedException('User not found');
    return toPublicUser(row);
  }
}
