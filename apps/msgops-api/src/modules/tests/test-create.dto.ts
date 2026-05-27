import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestMessageDto } from './test-message.dto';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class TestCreateDto {
  @ApiProperty()
  @JoiSchema(Joi.string().required())
  title: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().required())
  triggerId: number;

  @ApiProperty({ type: [TestMessageDto] })
  @JoiSchema(Joi.array().optional())
  messages: Array<TestMessageDto>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  provider: string;
}
