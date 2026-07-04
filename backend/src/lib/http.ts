import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { z, ZodError } from 'zod';

export function parseQuery<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    throw err;
  }
}

export function parseBody<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new BadRequestException({
        message: 'Invalid request body',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    throw err;
  }
}

export function unauthorized(message = 'Unauthorized'): never {
  throw new UnauthorizedException(message);
}

