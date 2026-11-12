import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Users } from 'src/users/entities/users.entity';
import { Order } from 'src/orders/entities/order.entity';
import { imagekit } from 'src/auth/utility/imagekit';
import { AVATAR_SIZES, AvatarSize, hasAvatar } from 'src/common/media';
import { MB } from 'src/common/upload';
import { ByteLru } from './byte-lru';

export interface AvatarImage {
  body: Buffer;
  contentType: string;
  etag: string;
}

/** One ImageKit fetch per picture and size per day, roughly (BE-28). */
export const AVATAR_CACHE_BYTES = 16 * MB;
export const AVATAR_CACHE_MS = 24 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

type AvatarRow = Pick<
  Users,
  'id' | 'avatarKey' | 'profileImagePath' | 'profileImageFileId'
>;
const AVATAR_COLUMNS: (keyof Users)[] = [
  'id',
  'avatarKey',
  'profileImagePath',
  'profileImageFileId',
];

/** ETag of one avatar size: changes with every new upload (new key). */
export const avatarEtag = (avatarKey: string, size: AvatarSize) =>
  `"${avatarKey}-${size}"`;

/**
 * BE-28: serves private profile pictures. The server fetches a resized,
 * face-centred square from ImageKit through a signed URL (never the
 * original) and keeps the bytes in a small LRU.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly cache = new ByteLru<AvatarImage>(
    AVATAR_CACHE_BYTES,
    AVATAR_CACHE_MS,
  );

  constructor(
    @InjectRepository(Users) private readonly users: Repository<Users>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  /** Owner of a public avatar key (review photos), or null. */
  findByKey(avatarKey: string): Promise<AvatarRow | null> {
    return this.users.findOne({
      select: AVATAR_COLUMNS,
      where: { avatarKey },
    });
  }

  findById(userId: string): Promise<AvatarRow | null> {
    return this.users.findOne({
      select: AVATAR_COLUMNS,
      where: { id: userId },
    });
  }

  /** A delivery man may see the pictures of customers on his own orders. */
  async isCustomerOf(deliveryManId: string, userId: string) {
    return this.orders.exists({ where: { deliveryManId, userId } });
  }

  /** The picture in one size, or null (no picture / ImageKit failed). */
  async image(
    user: AvatarRow | null,
    size: AvatarSize,
  ): Promise<AvatarImage | null> {
    if (!hasAvatar(user)) return null;
    const cacheKey = `${user.profileImageFileId ?? user.profileImagePath}:${size}`;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

    const px = String(AVATAR_SIZES[size]);
    const url = imagekit.url({
      path: user.profileImagePath!,
      transformation: [{ width: px, height: px, focus: 'face' }],
      signed: true,
      expireSeconds: 300,
    });
    try {
      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS,
      });
      const image: AvatarImage = {
        body: Buffer.from(res.data),
        contentType: String(res.headers['content-type'] ?? 'image/jpeg'),
        etag: avatarEtag(user.avatarKey!, size),
      };
      this.cache.set(cacheKey, image);
      return image;
    } catch (err) {
      this.logger.warn(
        `Avatar ${user.id}/${size} could not be fetched: ${String(err)}`,
      );
      return null;
    }
  }
}
