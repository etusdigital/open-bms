import { SetMetadata } from '@nestjs/common';
import { CRON_ROUTE_KEY } from './authz.constants';

export const CronRoute = () => SetMetadata(CRON_ROUTE_KEY, true);
