import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class TestSendgridDto {
  @JoiSchema(Joi.string().trim().pattern(/^SG\./, 'starts with SG.').min(10).required())
  apiKey: string;
}
