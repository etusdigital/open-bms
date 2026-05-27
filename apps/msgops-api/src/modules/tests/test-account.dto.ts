import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class TestAccountDto {
  @ApiProperty()
  @JoiSchema(Joi.string().required())
  activeCampaignAccountId: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  apiKey: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  testId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  version?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  append?: string;
}
