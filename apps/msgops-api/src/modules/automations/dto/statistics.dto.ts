import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class StatisticsDto {
  @JoiSchema(Joi.string().required())
  category: string;

  @JoiSchema(Joi.string().required())
  startDate: string;

  @JoiSchema(Joi.string().required())
  endDate: string;
}

export class StatisticsTargetDto {
  @JoiSchema(Joi.number().required())
  automationId: number;

  @JoiSchema(Joi.string().required())
  startDate: string;

  @JoiSchema(Joi.string().required())
  endDate: string;
}
