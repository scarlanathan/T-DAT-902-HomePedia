import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import type { PublicUser } from './auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user!;
  },
);
