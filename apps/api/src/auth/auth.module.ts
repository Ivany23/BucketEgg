import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { TokenModule } from './token.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [TokenModule, OrganizationsModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
