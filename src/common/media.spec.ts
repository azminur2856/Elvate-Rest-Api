import {
  hasAvatar,
  newAvatarKey,
  ownAvatarUrl,
  publicAvatarUrl,
  staffAvatarUrl,
  toImgPath,
} from './media';

const withPhoto = {
  id: 'u-1',
  avatarKey: 'X4NwfinymMYM7Hm6oXsR2pxt',
  profileImagePath: '/user_profile_image/user_u-1/me_abc.jpg',
};
const noPhoto = { id: 'u-2', avatarKey: null, profileImagePath: null };

describe('BE-28 avatar URLs', () => {
  it('a new key is random, URL-safe and 24 characters', () => {
    const a = newAvatarKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(newAvatarKey()).not.toBe(a);
  });

  it('needs both the key and the private path', () => {
    expect(hasAvatar(withPhoto)).toBe(true);
    expect(hasAvatar(noPhoto)).toBe(false);
    expect(hasAvatar({ ...withPhoto, profileImagePath: null })).toBe(false);
    expect(hasAvatar(null)).toBe(false);
  });

  it('own picture: /media/me/avatar with size and version', () => {
    expect(ownAvatarUrl(withPhoto)).toBe(
      '/media/me/avatar?size=md&v=X4NwfinymMYM7Hm6oXsR2pxt',
    );
    expect(ownAvatarUrl(withPhoto, 'xs')).toBe(
      '/media/me/avatar?size=xs&v=X4NwfinymMYM7Hm6oXsR2pxt',
    );
    expect(ownAvatarUrl(noPhoto)).toBeNull();
  });

  it('staff view: /media/users/<id>/avatar', () => {
    expect(staffAvatarUrl(withPhoto)).toBe(
      '/media/users/u-1/avatar?size=sm&v=X4NwfinymMYM7Hm6oXsR2pxt',
    );
    expect(staffAvatarUrl(withPhoto, 'md')).toContain('size=md');
    expect(staffAvatarUrl(noPhoto)).toBeNull();
  });

  it('reviews: /media/avatar/<key> only, never the user id', () => {
    expect(publicAvatarUrl(withPhoto)).toBe(
      '/media/avatar/X4NwfinymMYM7Hm6oXsR2pxt',
    );
    expect(publicAvatarUrl(withPhoto)).not.toContain('u-1');
    expect(publicAvatarUrl(noPhoto)).toBeNull();
  });

  it('no avatar URL ever contains an ImageKit host', () => {
    const urls = [
      ownAvatarUrl(withPhoto),
      staffAvatarUrl(withPhoto),
      publicAvatarUrl(withPhoto),
    ];
    for (const url of urls) expect(url).not.toMatch(/imagekit/i);
  });
});

describe('BE-28 shop photos as /img/ paths', () => {
  const saved = process.env.IMAGEKIT_URL_ENDPOINT;
  beforeAll(() => {
    process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/shop123/';
  });
  afterAll(() => {
    process.env.IMAGEKIT_URL_ENDPOINT = saved;
  });

  it('strips the configured endpoint and any query', () => {
    expect(
      toImgPath('https://ik.imagekit.io/shop123/products/p1/a.jpg?tr=w-400'),
    ).toBe('/img/products/p1/a.jpg');
  });

  it('strips any ik.imagekit.io account (older rows)', () => {
    expect(toImgPath('https://ik.imagekit.io/other/categories/c.png')).toBe(
      '/img/categories/c.png',
    );
  });

  it('bare paths get the /img prefix; /img paths stay', () => {
    expect(toImgPath('/products/p1/a.jpg')).toBe('/img/products/p1/a.jpg');
    expect(toImgPath('/img/products/p1/a.jpg')).toBe('/img/products/p1/a.jpg');
  });

  it('other URLs and empty values pass through', () => {
    expect(toImgPath('https://example.com/x.jpg')).toBe(
      'https://example.com/x.jpg',
    );
    expect(toImgPath(null)).toBeNull();
    expect(toImgPath('')).toBeNull();
  });
});
