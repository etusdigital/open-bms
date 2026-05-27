import { SetMetadata } from '@nestjs/common';
import { PUBLIC_ROUTE_KEY } from './authz.constants';

export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
