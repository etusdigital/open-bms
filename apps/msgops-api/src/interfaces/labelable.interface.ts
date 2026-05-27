import Joi from 'joi';

export interface LabelDto {
  id: number;
  name?: string;
}

export interface Labelable {
  labels?: Array<LabelDto>;
}

export const LabelsJoiSchema = Joi.array()
  .items(
    Joi.object({
      id: Joi.number().required(),
      name: Joi.string().optional(),
    }),
  )
  .allow(null)
  .optional();
