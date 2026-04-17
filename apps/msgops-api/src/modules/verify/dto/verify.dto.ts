import { ApiProperty, ApiPropertyOptional, ApiResponseProperty, OmitType, PartialType } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { VerifyMethod } from '../verify.interface';

export class VerifyDto {
  @ApiProperty({ description: 'Must be an e.164 phone number or an email address only.', example: '+5531988034355' })
  @JoiSchema(
    Joi.string()
      .pattern(new RegExp('^(?:\\+[1-9]\\d{1,14}|[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,10})$'))
      .rule({ message: 'TO must be an e.164 phone number or an email address only.' })
      .required(),
  )
  to: string;

  @ApiProperty({ enum: VerifyMethod })
  @JoiSchema(Joi.string().required())
  method: string;

  @ApiPropertyOptional({ description: 'Group to send the message to', example: 'default' })
  @JoiSchema(Joi.string().default('default').optional())
  group: string;

  @ApiPropertyOptional({
    description: 'Text to send to users (string) or array of custom text messages with weights (MessageItem[])',
    oneOf: [
      { type: 'string', example: 'Your verification code is {{CODE}}' },
      {
        type: 'array',
        items: { $ref: '#/components/schemas/MessageItem' },
        example: [
          { id: 1, message: 'Your verification code is {{CODE}}', percentage: 60 },
          { id: 2, message: 'Use this code to verify: {{CODE}}', percentage: 40 },
        ],
      },
    ],
  })
  @JoiSchema(Joi.string().pattern(new RegExp('(.)*{{CODE}}', 'i')).rule({ message: 'messages must include the placeholder {{CODE}}' }).max(160))
  customText: string;

  @ApiPropertyOptional({ description: 'Expiration time in seconds', example: 90 })
  @JoiSchema(Joi.number().allow(null, '').min(60).max(1800).optional())
  expiration: string;

  @ApiPropertyOptional({ description: 'Code user provided to be validated. Must be 6 digits long.', example: '123456' })
  @JoiSchema(Joi.string().allow(null, '').pattern(new RegExp('^[0-9]{6}$')).optional())
  code: string;

  @ApiPropertyOptional({ description: 'Return generated code' })
  @JoiSchema(Joi.bool().allow(null, '').optional())
  returnCode: boolean;
}

export class VerifyValidateDto extends OmitType(VerifyDto, ['customText', 'expiration'] as const) {
  @ApiPropertyOptional({ description: 'Group to send the message to', example: 'default' })
  @JoiSchema(Joi.string().default('default').optional())
  group: string;
}

export class VerifyGenerateResponse {
  @ApiResponseProperty({ example: '31988034355' })
  to: string;

  @ApiResponseProperty({ example: 'SMS' })
  channel: string;

  @ApiResponseProperty({ example: true })
  valid: boolean;

  @ApiResponseProperty({ example: '2023-07-07T02:31:58.645Z' })
  created_at: string;

  @ApiResponseProperty({ example: '2023-07-07T03:01:58.645Z' })
  expires_at: string;
}

export class VerifyValidateResponse extends PartialType(VerifyGenerateResponse) {
  @ApiResponseProperty({ example: 'approved' })
  status: string;
}

export class VerifyStatisticsResponse {
  @ApiProperty({ example: '2023-07-07', description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ example: 'SMS', description: 'Method used to send the verification code', enum: VerifyMethod })
  method: string;

  @ApiProperty({ example: 12, description: 'Total number of 2FA requests' })
  count_total: number;

  @ApiProperty({ example: 10, description: 'Total number of 2FA requests that were successfully sent' })
  count_success: number;

  @ApiProperty({ example: 2, description: 'Total number of 2FA failed requests (validation error)' })
  count_error: number;

  @ApiProperty({ example: 8, description: 'Total number of 2FA requests that were successfully validated' })
  count_verify_validated: number;

  @ApiProperty({ example: 2, description: 'Total number of 2FA requests that were rejected (expired, invalid code, etc.)' })
  count_verify_rejected: number;
}
