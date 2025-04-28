import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
