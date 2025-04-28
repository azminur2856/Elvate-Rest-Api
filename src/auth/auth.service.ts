// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

/**
 * Service handling authentication operations.
 * @class AuthService
 * @description Manages user authentication, including login and token generation.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticates a user and generates a JWT token.
   * @param loginDto - User login credentials
   * @returns Promise<{ access_token: string }> - JWT token for authenticated user
   * @throws UnauthorizedException - If credentials are invalid
   */
  async login(loginDto: LoginDto) {
    try {
      const user = await this.usersRepository.findOne({
        where: { email: loginDto.email },
        relations: ['roles'],
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User is inactive');
      }

      // Update last login time
      user.lastLoginAt = new Date();
      await this.usersRepository.save(user);

      const payload = { 
        sub: user.id, 
        email: user.email, 
        role: user.roles[0]?.name || 'USER' 
      };

      return {
        access_token: this.jwtService.sign(payload),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Error during login');
    }
  }
}
