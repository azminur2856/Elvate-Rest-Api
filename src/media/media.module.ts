import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Order } from 'src/orders/entities/order.entity';
import { AvatarService } from './avatar.service';
import { MediaController } from './media.controller';

/** BE-28: /media routes for private profile pictures. */
@Module({
  imports: [TypeOrmModule.forFeature([Users, Order])],
  controllers: [MediaController],
  providers: [AvatarService],
  exports: [AvatarService],
})
export class MediaModule {}
