import { Module } from '@nestjs/common';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { CustomFieldsService } from './custom-fields.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomFieldsController } from '../custom-fields/custom-fields.controller';
import { UtilsService } from '../../utils/utils.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [TypeOrmModule.forFeature([CustomFieldsEntity]), AccountsModule],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService, UtilsService],
})
export class CustomFieldsModule {}
