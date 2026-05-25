import { ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class ActivityQueryDto {
  @ApiPropertyOptional({ description: 'GitHub-style filter query (account:, contact:, event:, ...)' })
  @JoiSchema(Joi.string().allow('').optional())
  q?: string;

  @ApiPropertyOptional({ description: 'Opaque pagination cursor returned by previous response' })
  @JoiSchema(Joi.string().optional())
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size (1-200)', default: 50 })
  @JoiSchema(Joi.number().integer().min(1).max(200).optional().default(50))
  limit?: number;
}

export interface ActivityCursorPayload {
  time: string;
  id: string;
}

export function encodeCursor(c: ActivityCursorPayload): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): ActivityCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed.time !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('cursor missing time/id');
    }
    return parsed;
  } catch (err) {
    throw new Error(`Invalid cursor: ${(err as Error).message}`, { cause: err });
  }
}
