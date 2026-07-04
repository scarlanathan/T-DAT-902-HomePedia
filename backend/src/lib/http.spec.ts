import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { parseQuery } from './http';

describe('parseQuery', () => {
  it('parses valid inputs', () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(10).default(5),
      q: z.string().optional(),
    });

    const out = parseQuery(schema, { limit: '3', q: 'paris' });
    expect(out).toEqual({ limit: 3, q: 'paris' });
  });

  it('throws BadRequestException on invalid inputs', () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(10),
    });

    expect(() => parseQuery(schema, { limit: '999' })).toThrow(BadRequestException);
  });
});

