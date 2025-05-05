import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { CreateUserDto } from './dto/CreateUser.dto';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const userExists = await this.userService.findByEmail(createUserDto.email);
    if (userExists) {
      throw new ConflictException(
        `Cannot register: Email: ${createUserDto.email} already exists`,
      );
    }
    const newUser = await this.userService.create(createUserDto);
    return { message: 'User registered', user: newUser };
  }
  //   async validateUser(email: string, password: string): Promise<any> {
  //     const user = await this.userRepository.findOne({ where: { email } });
  //     if (user && (await bcrypt.compare(password, user.password))) {
  //       const { password, ...result } = user;
  //       return result;
  //     }
  //     return null;
  //   }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user.id, role: user.role };
    const access_token = this.jwtService.sign(payload);
    const decoded = this.jwtService.verify(access_token);
    return {
      access_token,
      // user: {
      //   id: user.id,
      //   role: user.role,
      // },
      id: decoded.sub,
      role: decoded.role,
    };
  }
}
