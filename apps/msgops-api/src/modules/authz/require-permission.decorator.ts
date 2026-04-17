import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY } from './authz.constants';

export const RequirePermission = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
