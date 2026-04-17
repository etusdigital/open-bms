import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
export class EmailTemplateDto {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  title?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiProperty()
  creationError?: boolean;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  content_json?: string;

  @ApiProperty()
  fromName: string;

  @ApiProperty()
  fromMail: string;

  @ApiProperty()
  toName: string;

  @ApiProperty()
  toMail: string;

  @ApiPropertyOptional()
  isTested?: boolean;

  @ApiPropertyOptional()
  testId?: string;

  @ApiPropertyOptional()
  fileName?: string;

  @ApiPropertyOptional()
  templateUrl?: string;

  @ApiPropertyOptional()
  bucketName?: string;
}
