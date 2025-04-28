import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { UserRewardsService } from '../services/userRewards.service';
import { CreateUserRewardsDto } from '../dto/create_user_rewards.dto';
import { UpdateUserRewardsDto } from '../dto/update_user_rewards.dto';

@Controller('user-rewards')
export class UserRewardsController {
  constructor(private readonly userRewardsService: UserRewardsService) {}

  @Post()
  create(@Body() dto: CreateUserRewardsDto) {
    return this.userRewardsService.create(dto);
  }

  @Get()
  findAll() {
    return this.userRewardsService.findAll();
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateUserRewardsDto) {
    return this.userRewardsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.userRewardsService.delete(id);
  }
}
