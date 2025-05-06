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
import { PendingUser } from 'src/user/entities/pending_user.entity';
import { VerifyOtpDto } from 'src/user/dto/verify_otp.dto';
import { RequestOtpDto } from 'src/user/dto/request_otp.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private userService: UserService,
    private mailerService: MailerService,
    @InjectRepository(PendingUser)
    private pendingUserRepo: Repository<PendingUser>,
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

  // async requestOtp(dto: RequestOtpDto) {
  //   const existing = await this.userRepository.findOne({
  //     where: { email: dto.email },
  //   });
  //   if (existing) throw new ConflictException('Email already registered');

  //   const otp = Math.floor(100000 + Math.random() * 900000).toString();

  //   const hashedPassword = await bcrypt.hash(dto.password, 10);

  //   const pending = this.pendingUserRepo.create({
  //     email: dto.email,
  //     password: hashedPassword,
  //     otp,
  //   });

  //   await this.pendingUserRepo.save(pending);

  //   console.log(`Simulated email OTP: ${otp}`);

  //   return { message: 'OTP sent to email' };
  // }

  // async verifyOtp(dto: VerifyOtpDto) {
  //   const pending = await this.pendingUserRepo.findOne({
  //     where: { email: dto.email, otp: dto.otp },
  //   });

  //   if (!pending) {
  //     throw new UnauthorizedException('Invalid OTP');
  //   }

  //   const newUser = this.userRepository.create({
  //     email: pending.email,
  //     password: pending.password,
  //   });

  //   await this.userRepository.save(newUser);
  //   await this.pendingUserRepo.delete({ email: dto.email });

  //   return { message: 'User registered successfully', user: newUser };
  // }

  async requestOtp(dto: RequestOtpDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // const hashedPassword = await bcrypt.hash(dto.password, 10);

    const pending = this.pendingUserRepo.create({
      email: dto.email,
      password: dto.password,
      otp,
    });

    await this.pendingUserRepo.save(pending);

    await this.mailerService.sendMail({
      to: dto.email,
      subject: 'Your OTP Code',
      text: `Your OTP is ${otp}`,
      html: `<p>Hello,</p><p>Your OTP is <strong>${otp}</strong>.</p><p>This code will expire in 10 minutes.</p>`,
    });

    return { message: 'OTP sent to email' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const pending = await this.pendingUserRepo.findOne({
      where: { email: dto.email, otp: dto.otp },
    });

    if (!pending) {
      throw new UnauthorizedException('Invalid OTP or email');
    }

    const newUser = this.userRepository.create({
      email: pending.email,
      password: pending.password, // already hashed
    });

    await this.userRepository.save(newUser);
    await this.pendingUserRepo.delete({ email: dto.email });

    return { message: 'User registered successfully', user: newUser };
  }
}
