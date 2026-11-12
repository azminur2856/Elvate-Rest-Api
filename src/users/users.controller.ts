import { ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AccountService } from 'src/account/account.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './enums/role.enum';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { RATE_LIMITS, RateLimit } from 'src/auth/throttle/rate-limit';
import {
  FACE_PHOTO_UPLOAD,
  MB,
  NO_FACE_PHOTO,
  SingleFileUpload,
} from 'src/common/upload';
import { FaceReferenceService } from 'src/face/face-reference.service';
import type { AuthRequest } from 'src/common/auth-user';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly faceReferences: FaceReferenceService,
    private readonly usersService: UsersService,
    private readonly account: AccountService,
  ) {}

  @Public()
  @Post('createUser')
  @RateLimit(RATE_LIMITS.createUser)
  createUser(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Roles(Role.ADMIN)
  @Get('getAllUsers')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Roles(Role.ADMIN)
  @Get('getAllUsersWithTotalPaid')
  async getPaginatedUsersWithTotalPaid(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'firstName',
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    return await this.usersService.getPaginatedUsersWithTotalPaid(
      pageNum,
      pageSizeNum,
      sortBy || 'firstName',
      search,
    );
  }

  /** `hasPassword: false` = Google-only sign-up (delete-account asks to type DELETE). */
  @Get('profile')
  async getUserProfile(@Req() req: any) {
    const [user, hasPassword] = await Promise.all([
      this.usersService.getUserById(req.user.id),
      this.account.hasPassword(req.user.id),
    ]);
    return { ...user, hasPassword };
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
  @Patch('updateUserStatus/:id')
  updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: 'true' | 'false',
    @Req() req: any,
  ) {
    if (!['true', 'false'].includes(status)) {
      throw new HttpException(
        'Invalid status value. Use "true" or "false".',
        HttpStatus.BAD_REQUEST,
      );
    }
    const isActive = status === 'true';
    return this.usersService.updateUserStatus(id, isActive, req.user.id);
  }

  @Roles(Role.ADMIN)
  @Delete('deleteUser/:id')
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.usersService.deteteUser(id, req.user.id);
  }

  // ImageKit file upload
  @Patch('updateProfileImage')
  @UseInterceptors(
    SingleFileUpload('profileImage', {
      maxBytes: 5 * MB,
      mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
      typeError: 'Only image files are allowed (jpg, jpeg, png, gif)',
    }),
  )
  async updateProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const currentUser = req.user;
    const uniqueFileName = `profileImage-user-${currentUser.id}-${Date.now()}`;

    const imagekitResponse = await this.usersService.uploadProfileImage(
      currentUser.id,
      file.buffer,
      file.mimetype,
      uniqueFileName,
    );

    return imagekitResponse;
  }

  @Roles(Role.ADMIN)
  @Get('getUserById/:id')
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  /**
   * SEC-04 face setup: a live camera photo (multipart `photo`) becomes the
   * private reference face login compares against.
   */
  @Post('face-reference')
  @UseInterceptors(SingleFileUpload('photo', FACE_PHOTO_UPLOAD))
  @RateLimit(RATE_LIMITS.faceSetup)
  setFaceReference(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No photo uploaded (multipart field "photo").',
      );
    }
    return this.faceReferences.enroll(req.user.id, file.buffer);
  }

  /** Turns face login off and deletes the private photo. */
  @Delete('face-reference')
  removeFaceReference(@Req() req: AuthRequest) {
    return this.faceReferences.remove(req.user.id);
  }

  /**
   * Deprecated alias of POST /users/face-reference (field `liveImage`).
   * Before SEC-04 this compared against the public profile picture.
   */
  @Post('verify-face')
  @UseInterceptors(SingleFileUpload('liveImage', FACE_PHOTO_UPLOAD))
  @RateLimit(RATE_LIMITS.faceSetup)
  async verifyFace(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    if (!file) throw new BadRequestException(NO_FACE_PHOTO);
    const state = await this.faceReferences.enroll(req.user.id, file.buffer);
    return { verified: true, ...state };
  }

  @Roles(Role.ADMIN)
  @Get('userStats')
  async getUserStats() {
    return this.usersService.getUserStats();
  }
}
