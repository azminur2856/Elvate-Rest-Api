import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
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
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Public } from 'src/auth/decorators/public.decorator';
import { FaceVerificationService } from './services/face-verification.service';
import { resizeToBase64 } from 'src/auth/utility/resize-to-base64.util';

@Controller('users')
export class UsersController {
  constructor(
    private readonly faceVerificationService: FaceVerificationService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('createUser')
  createUser(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Roles(Role.ADMIN)
  @Get('getAllUsers')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

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

  @Roles(Role.ADMIN)
  @Patch('updateUserRole/:id')
  updateUserRole(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserRoleDto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    return this.usersService.updateUserRole(id, updateUserRoleDto, req.user.id);
  }

  @Roles(Role.ADMIN)
  @Delete('deleteUser/:id')
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.usersService.deteteUser(id, req.user.id);
  }

  @Patch('updateProfileImage')
  @UseInterceptors(
    FileInterceptor('profileImage', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const currentUser: CurrentUser = req.user as CurrentUser;
          const userId = currentUser.id;

          const uploadPath = path.join(
            __dirname,
            '..',
            '..',
            'assets',
            'user_profile_image',
            `user_${userId}`,
          );

          // Ensure the directory exists or create it dynamically
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath); // Set the destination folder.
        },
        filename: (req, file, cb) => {
          const currentUser: CurrentUser = req.user as CurrentUser;
          const userId = currentUser.id;

          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileExt = extname(file.originalname);
          cb(null, `profileImage-user-${userId}-${uniqueSuffix}${fileExt}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Accept only image files.
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new HttpException(
              'Only image files are allowed (jpg, jpeg, png, gif)',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // Set file size limit to 5 MB.
    }),
  )
  updateProfileImage(
    @UploadedFile() profileImage: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!profileImage) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    return this.usersService.updateProfileImage(
      req.user.id,
      profileImage.filename,
    );
  }

  @Roles(Role.ADMIN)
  @Get('getUserById/:id')
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  // @Post('verify-face')
  // @UseInterceptors(FileInterceptor('liveImage'))
  // async verifyFace(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
  //   const user = await this.usersService.findOne(req.user.id);
  //   if (!user) throw new NotFoundException('User not found');

  //   const profileImagePath = path.join(
  //     __dirname,
  //     '..',
  //     '..',
  //     'assets',
  //     'user_profile_image',
  //     `user_${user.id}`,
  //     user.profileImage,
  //   );

  //   if (!fs.existsSync(profileImagePath)) {
  //     throw new NotFoundException('Profile image not found');
  //   }

  //   const profileImageBase64 = fs
  //     .readFileSync(profileImagePath)
  //     .toString('base64');
  //   const liveImageBase64 = file.buffer.toString('base64');

  //   const isMatch = await this.faceVerificationService.compareFaces(
  //     profileImageBase64,
  //     liveImageBase64,
  //   );
  //   console.log('Face match result:', isMatch); // Debug

  //   if (isMatch) {
  //     await this.usersService.markFaceAsVerified(user.id);
  //   }

  //   return { verified: isMatch };
  // }

  @Post('verify-face')
  @UseInterceptors(FileInterceptor('liveImage'))
  async verifyFace(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    if (!user) throw new NotFoundException('User not found');

    const profileImagePath = path.join(
      __dirname,
      '..',
      '..',
      'assets',
      'user_profile_image',
      `user_${user.id}`,
      user.profileImage,
    );

    if (!fs.existsSync(profileImagePath)) {
      throw new NotFoundException('Profile image not found');
    }

    // Resize both profile image and live image to base64
    const profileImageBuffer = fs.readFileSync(profileImagePath);
    const profileImageBase64 = await resizeToBase64(profileImageBuffer);

    const liveImageBase64 = await resizeToBase64(file.buffer); // also compress live image

    const isMatch = await this.faceVerificationService.compareFaces(
      profileImageBase64,
      liveImageBase64,
    );

    if (isMatch) {
      await this.usersService.markFaceAsVerified(user.id);
    }

    return { verified: isMatch };
  }
}
