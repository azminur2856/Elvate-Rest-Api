import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { PendingUser } from './entities/pending_user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, PendingUser])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule.forFeature([User, PendingUser])],
})
export class UserModule {}
