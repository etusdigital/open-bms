import { ApiProperty } from '@nestjs/swagger';
import { TestAccountDto } from './test-account.dto';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class TestMessageDto {
  @ApiProperty({ type: [TestAccountDto] })
  @JoiSchema(Joi.array().optional())
  accounts?: Array<TestAccountDto>;

  @JoiSchema(Joi.array().optional())
  audiences: Array<any>;

  @JoiSchema(Joi.array().optional())
  silos?: Array<any>;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  subject: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  content: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  text: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  fromMail: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  fromName: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  ipPool: string;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  version: number;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  id: number;

  @ApiProperty()
  @JoiSchema(Joi.array().required())
  SeedList?: Array<string>;
}
