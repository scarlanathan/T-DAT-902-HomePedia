import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../../lib/auth-token';
import { AuthService, type PublicUser } from './auth.service';

export type AuthenticatedRequest = Request & { user?: PublicUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Not authenticated');

    try {
      const payload = verifyAuthToken(token, this.config.get<string>('JWT_SECRET', 'dev-only-change-me'));
      const user = await this.auth.findUserById(payload.sub);
      if (!user) throw new UnauthorizedException('Not authenticated');
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Not authenticated');
    }
  }
}
