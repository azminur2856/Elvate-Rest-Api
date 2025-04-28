// src/auth/strategeies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';  // Import JwtPayload interface

/**
 * JWT Strategy for handling authentication.
 * @class JwtStrategy
 * @description Implements JWT-based authentication strategy using Passport.
 * Extracts JWT from request headers and validates the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in the environment variables');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validates the JWT payload.
   * @param payload - The JWT payload containing user information
   * @returns The validated payload
   */
  async validate(payload: JwtPayload) {  // Use the JwtPayload type
    const { sub: id } = payload;
    
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await this.usersRepository.save(user);

    return user;
  }
}
