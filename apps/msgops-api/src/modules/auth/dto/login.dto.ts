import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', format: 'email' })
  @JoiSchema(
    Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  )
  email: string;

  @ApiProperty({ example: 'ChangeMe123!', minLength: 8, writeOnly: true })
  @JoiSchema(Joi.string().min(8).required())
  password: string;
}
