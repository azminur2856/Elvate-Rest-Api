import { randomBytes } from 'crypto';

/**
 * BE-28 photo system: the API only ever returns its own paths, never an
 * ImageKit address. Avatars come from /media/..., shop photos from /img/...
 * (the frontend rewrites /img to the image CDN).
 */

/** Square avatar sizes in pixels. */
export const AVATAR_SIZES = { xs: 64, sm: 128, md: 320 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

/** New random, URL-safe key on every upload (24 chars). */
export const newAvatarKey = (): string => randomBytes(18).toString('base64url');

export interface AvatarOwner {
  id: string;
  avatarKey?: string | null;
  profileImagePath?: string | null;
}

/** True when the user has a (private) profile picture. */
export const hasAvatar = (
  u: AvatarOwner | null | undefined,
): u is AvatarOwner => !!u?.avatarKey && !!u.profileImagePath;

/** The owner's own picture (profile page, session user). */
export const ownAvatarUrl = (
  u: AvatarOwner | null | undefined,
  size: AvatarSize = 'md',
): string | null =>
  hasAvatar(u) ? `/media/me/avatar?size=${size}&v=${u.avatarKey}` : null;

/** Another user's picture for staff (lists, order customer, delivery). */
export const staffAvatarUrl = (
  u: AvatarOwner | null | undefined,
  size: Exclude<AvatarSize, 'xs'> = 'sm',
): string | null =>
  hasAvatar(u)
    ? `/media/users/${u.id}/avatar?size=${size}&v=${u.avatarKey}`
    : null;

/** Public 64 px picture next to reviews. */
export const publicAvatarUrl = (
  u: AvatarOwner | null | undefined,
): string | null => (hasAvatar(u) ? `/media/avatar/${u.avatarKey}` : null);

/**
 * Shop photo as `/img/<imagekit-path>`. Accepts a full ImageKit URL (as
 * stored in older rows), a bare path or an /img path; other URLs pass
 * through unchanged.
 */
export function toImgPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/img/')) return value;
  const endpoint = (process.env.IMAGEKIT_URL_ENDPOINT ?? '').replace(
    /\/+$/,
    '',
  );
  let path: string | null = null;
  if (endpoint && value.startsWith(`${endpoint}/`)) {
    path = value.slice(endpoint.length);
  } else {
    const m = /^https?:\/\/ik\.imagekit\.io\/[^/]+(\/.*)$/.exec(value);
    if (m) path = m[1];
    else if (value.startsWith('/')) path = value;
  }
  if (path === null) return value;
  return `/img${path.split('?')[0]}`;
}
