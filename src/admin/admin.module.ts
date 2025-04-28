import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUserController } from './controllers/admin-user.controller'
import { AdminUserService } from './services/admin-user.service'
import { Users } from 'src/users/entities/users.entity'
import { Roles } from 'src/users/entities/roles.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Users, Roles])],
  controllers: [AdminUserController],
  providers: [AdminUserService],
  exports: [],
})
export class AdminModule {}
