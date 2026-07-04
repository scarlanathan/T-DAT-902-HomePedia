import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { AUTH_COOKIE_NAME } from '../../lib/auth-token';
import { parseBody } from '../../lib/http';
import { AuthGuard } from './auth.guard';
import { AuthService, type PublicUser } from './auth.service';
import { CurrentUser } from './current-user.decorator';

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  display_name: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(['en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const settingsSchema = z
  .object({
    locale: z.enum(['en', 'fr']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  })
  .refine((v) => v.locale !== undefined || v.theme !== undefined, {
    message: 'At least one setting is required',
  });

const preferencesSchema = z.object({
  incomeMonthlyEur: z.number().nonnegative().nullable(),
  downPaymentEur: z.number().nonnegative().nullable(),
  maxDti: z.number().min(0.05).max(0.6),
  termYears: z.number().int().min(5).max(35),
  propertyType: z.enum(['', 'Appartement', 'Maison']),
  weights: z.object({
    price: z.number().min(0).max(1),
    social: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
  }),
});

function setAuthCookie(res: Response, token: string): void {
  const secure = process.env.COOKIE_SECURE === 'true';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        displayName: { type: 'string' },
        locale: { type: 'string', enum: ['en', 'fr'] },
        theme: { type: 'string', enum: ['light', 'dark'] },
      },
      required: ['id', 'email', 'displayName', 'locale', 'theme'],
    },
  })
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parseBody(registerSchema, body);
    const { user, token } = await this.auth.register({
      email: input.email,
      password: input.password,
      displayName: input.display_name,
      locale: input.locale,
      theme: input.theme,
    });
    setAuthCookie(res, token);
    return user;
  }

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parseBody(loginSchema, body);
    const { user, token } = await this.auth.login({
      email: input.email,
      password: input.password,
    });
    setAuthCookie(res, token);
    return user;
  }

  @Post('logout')
  @ApiOkResponse({
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  })
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: PublicUser) {
    return user;
  }

  @Patch('me/settings')
  @UseGuards(AuthGuard)
  async updateSettings(
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    const input = parseBody(settingsSchema, body);
    return this.auth.updateSettings(user.id, {
      locale: input.locale,
      theme: input.theme,
    });
  }

  @Patch('me/preferences')
  @UseGuards(AuthGuard)
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    const prefs = parseBody(preferencesSchema, body);
    return this.auth.savePreferences(user.id, prefs);
  }
}
