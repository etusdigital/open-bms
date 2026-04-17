import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export type Accounts = {
  accountId: number;
  isMasterUser: boolean;
  roleOverrideCode?: string | null;
};

export class PermissionsAccountsDto {
  @JoiSchema(Joi.number().required())
  userId: number;

  @JoiSchema(Joi.number().optional())
  userMasterId?: number;

  @JoiSchema(Joi.array().allow(null).required())
  accounts: Accounts[];
}
