import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsIn, IsOptional } from 'class-validator';
import { AvatarImage, AvatarService, avatarEtag } from './avatar.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import type { AuthUser } from 'src/common/auth-user';
import type { AvatarSize } from 'src/common/media';

export class OwnAvatarQueryDto {
  @IsOptional()
  @IsIn(['xs', 'sm', 'md'])
  size?: AvatarSize;
}

export class StaffAvatarQueryDto {
  @IsOptional()
  @IsIn(['sm', 'md'])
  size?: 'sm' | 'md';
}

const PUBLIC_CACHE = 'public, max-age=31536000, immutable';
const PRIVATE_CACHE = 'private, max-age=86400';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const NO_PICTURE = 'No profile picture';

/** BE-28: profile pictures, served by us (never an ImageKit address). */
@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly avatars: AvatarService) {}

  /** Review photos: 64 px, cached for a year (the key changes on upload). */
  @Public()
  @Get('avatar/:avatarKey')
  async byKey(@Param('avatarKey') avatarKey: string, @Res() res: Response) {
    if (!KEY_PATTERN.test(avatarKey)) throw new NotFoundException(NO_PICTURE);
    const user = await this.avatars.findByKey(avatarKey);
    send(res, await this.avatars.image(user, 'xs'), PUBLIC_CACHE);
  }

  /** The caller's own picture. */
  @Get('me/avatar')
  async mine(
    @Query() query: OwnAvatarQueryDto,
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
  ) {
    const size = query.size ?? 'md';
    const user = await this.avatars.findById(req.user.id);
    if (notModified(req, res, user?.avatarKey, size)) return;
    send(res, await this.avatars.image(user, size), PRIVATE_CACHE);
  }

  /** Staff lists, order customer, delivery (riders: own customers only). */
  @Roles(Role.ADMIN, Role.STAFF, Role.DELIVERY_MAN)
  @Get('users/:id/avatar')
  async ofUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StaffAvatarQueryDto,
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
  ) {
    if (
      req.user.role === Role.DELIVERY_MAN &&
      !(await this.avatars.isCustomerOf(req.user.id, id))
    ) {
      throw new NotFoundException(NO_PICTURE); // like a user without one
    }
    const size = query.size ?? 'sm';
    const user = await this.avatars.findById(id);
    if (notModified(req, res, user?.avatarKey, size)) return;
    send(res, await this.avatars.image(user, size), PRIVATE_CACHE);
  }
}

/** 304 straight from the ETag (avatarKey + size): no ImageKit call. */
function notModified(
  req: Request,
  res: Response,
  avatarKey: string | null | undefined,
  size: AvatarSize,
): boolean {
  if (!avatarKey) return false;
  const etag = avatarEtag(avatarKey, size);
  if (req.headers['if-none-match'] !== etag) return false;
  res.set({ ETag: etag, 'Cache-Control': PRIVATE_CACHE }).status(304).end();
  return true;
}

function send(res: Response, image: AvatarImage | null, cache: string) {
  if (!image) throw new NotFoundException(NO_PICTURE);
  res
    .set({
      'Content-Type': image.contentType,
      'Cache-Control': cache,
      ETag: image.etag,
    })
    .send(image.body);
}
