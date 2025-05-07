import { SetMetadata } from '@nestjs/common';

export const NoJwtBlacklistGuard = () => SetMetadata('noJwtBlacklist', true);
