import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRewards } from '../entities/user_rewards.entity';
import { CreateUserRewardsDto } from '../dto/create_user_rewards.dto';
import { UpdateUserRewardsDto } from '../dto/update_user_rewards.dto';

@Injectable()
export class UserRewardsService {
  constructor(
    @InjectRepository(UserRewards)
    private readonly userRewardsRepository: Repository<UserRewards>,
  ) {}

  async create(dto: CreateUserRewardsDto): Promise<UserRewards> {
    const reward = this.userRewardsRepository.create(dto);
    return this.userRewardsRepository.save(reward);
  }

  async update(id: number, dto: UpdateUserRewardsDto): Promise<UserRewards> {
    const reward = await this.userRewardsRepository.findOne({ where: { id } });
    if (!reward) {
      throw new NotFoundException(`UserReward with ID ${id} not found`);
    }
    Object.assign(reward, dto);
    return this.userRewardsRepository.save(reward);
  }

  async delete(id: number): Promise<{ message: string }> {
    const result = await this.userRewardsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`UserReward with ID ${id} not found`);
    }
    return { message: `UserReward with ID ${id} deleted successfully` };
  }

  async findAll(): Promise<UserRewards[]> {
    return this.userRewardsRepository.find();
  }
}
