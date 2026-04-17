import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { PageDto } from './page.dto';
export class FiltersDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional().uppercase())
  public sortOrder: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public orderBy: string;
}
