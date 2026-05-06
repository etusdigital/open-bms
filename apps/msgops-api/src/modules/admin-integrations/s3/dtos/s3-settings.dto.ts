import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class S3SettingsDto {
  @JoiSchema(Joi.string().uri().optional().allow(''))
  endpoint?: string;

  @JoiSchema(Joi.string().trim().optional().default('us-east-1'))
  region?: string;

  @JoiSchema(Joi.string().trim().min(1).max(255).required())
  bucket: string;

  @JoiSchema(Joi.string().trim().min(8).max(512).required())
  accessKeyId: string;

  // Optional on update — service merges with the existing secret if absent.
  @JoiSchema(Joi.string().trim().min(8).max(512).optional())
  secretAccessKey?: string;

  @JoiSchema(Joi.boolean().optional())
  useObjectAcls?: boolean;

  @JoiSchema(Joi.string().hostname().optional().allow(''))
  assetsUrl?: string;
}

export const s3SettingsSaveSchema = Joi.object<S3SettingsDto>({
  endpoint: Joi.string().uri().optional().allow(''),
  region: Joi.string().trim().optional().default('us-east-1'),
  bucket: Joi.string().trim().min(1).max(255).required(),
  accessKeyId: Joi.string().trim().min(8).max(512).required(),
  secretAccessKey: Joi.string().trim().min(8).max(512).optional(),
  useObjectAcls: Joi.boolean().optional(),
  assetsUrl: Joi.string().hostname().optional().allow(''),
});

export class S3TestConnectionDto {
  @JoiSchema(Joi.string().uri().optional().allow(''))
  endpoint?: string;

  @JoiSchema(Joi.string().trim().optional())
  region?: string;

  @JoiSchema(Joi.string().trim().min(1).max(255).optional())
  bucket?: string;

  @JoiSchema(Joi.string().trim().min(8).max(512).optional())
  accessKeyId?: string;

  @JoiSchema(Joi.string().trim().min(8).max(512).optional())
  secretAccessKey?: string;
}

export const s3TestConnectionSchema = Joi.object<S3TestConnectionDto>({
  endpoint: Joi.string().uri().optional().allow(''),
  region: Joi.string().trim().optional(),
  bucket: Joi.string().trim().min(1).max(255).optional(),
  accessKeyId: Joi.string().trim().min(8).max(512).optional(),
  secretAccessKey: Joi.string().trim().min(8).max(512).optional(),
});
