import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './enums/role.enum';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CurrentUser } from 'src/auth/types/current-user';
import * as path from 'path';
import * as fs from 'fs';
import { extname } from 'path';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('createUser')
  createUser(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get('getAllUsers')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getUserProfile(@Req() req: any) {
    return this.usersService.getUserById(req.user.id);
  }

  @Get('profileImage')
  getUserProfileImage(@Req() req: any, @Res() res: Response) {
    return this.usersService.getUserProfileImage(req.user.id, res);
  }

  @Patch('updateUser')
  updateUser(
    @Req() req: any,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(req.user.id, updateUserDto);
  }

  //add role deceroator to this endpoint admin only
  @Patch('updateUserRole/:id')
  updateUserRole(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserRoleDto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    return this.usersService.updateUserRole(id, updateUserRoleDto, req.user.id);
  }

  //add role deceroator to this endpoint admin only
  @Delete('deleteUser/:id')
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.usersService.deteteUser(id, req.user.id);
  }

  // @Patch('updateProfileImage')
  // @UseInterceptors(
  //   FileInterceptor('profileImage', {
  //     storage: diskStorage({
  //       destination: (req, file, cb) => {
  //         const currentUser: CurrentUser = req.user as CurrentUser;
  //         const userId = currentUser.id;

  //         const uploadPath = path.join(
  //           __dirname,
  //           '..',
  //           '..',
  //           'assets',
  //           'user_profile_image',
  //           `user_${userId}`,
  //         );

  //         // Ensure the directory exists or create it dynamically
  //         if (!fs.existsSync(uploadPath)) {
  //           fs.mkdirSync(uploadPath, { recursive: true });
  //         }
  //         cb(null, uploadPath); // Set the destination folder.
  //       },
  //       filename: (req, file, cb) => {
  //         const currentUser: CurrentUser = req.user as CurrentUser;
  //         const userId = currentUser.id;

  //         const uniqueSuffix =
  //           Date.now() + '-' + Math.round(Math.random() * 1e9);
  //         const fileExt = extname(file.originalname);
  //         cb(null, `profileImage-user-${userId}-${uniqueSuffix}${fileExt}`);
  //       },
  //     }),
  //     fileFilter: (req, file, cb) => {
  //       // Accept only image files.
  //       if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
  //         return cb(
  //           new HttpException(
  //             'Only image files are allowed (jpg, jpeg, png, gif)',
  //             HttpStatus.BAD_REQUEST,
  //           ),
  //           false,
  //         );
  //       }
  //       cb(null, true);
  //     },
  //     limits: { fileSize: 5 * 1024 * 1024 }, // Set file size limit to 5 MB.
  //   }),
  // )
  // updateProfileImage(
  //   @UploadedFile() profileImage: Express.Multer.File,
  //   @Req() req: any,
  // ) {
  //   if (!profileImage) {
  //     throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
  //   }
  //   return this.usersService.updateProfileImage(
  //     req.user.id,
  //     profileImage.filename,
  //   );
  // }
}
