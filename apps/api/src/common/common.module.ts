import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service.js';
import { AuthCacheService } from './auth-cache.service.js';

@Global()
@Module({
  providers: [AccessService, AuthCacheService],
  exports: [AccessService, AuthCacheService],
})
export class CommonModule {}
