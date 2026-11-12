import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MediaController } from './media.controller';
import { AvatarImage, AvatarService, avatarEtag } from './avatar.service';
import { Role } from 'src/users/enums/role.enum';
import type { AuthUser } from 'src/common/auth-user';
import { withAvatarUrl } from 'src/users/users.service';

const KEY = 'X4NwfinymMYM7Hm6oXsR2pxt';
const USER_ID = '723b920d-ae64-44c4-b491-018b8d70ac4d';
const row = {
  id: USER_ID,
  avatarKey: KEY,
  profileImagePath: `/user_profile_image/user_${USER_ID}/me.jpg`,
  profileImageFileId: 'file-1',
};
const image = (size: string): AvatarImage => ({
  body: Buffer.from('jpeg'),
  contentType: 'image/jpeg',
  etag: `"${KEY}-${size}"`,
});

function fakeRes() {
  const res = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as Buffer | undefined,
    set(h: Record<string, string>) {
      Object.assign(res.headers, h);
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(b: Buffer) {
      res.body = b;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

const req = (user: Partial<AuthUser>, ifNoneMatch?: string) =>
  ({
    user,
    headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {},
  }) as unknown as Request & { user: AuthUser };

function setup() {
  const avatars = {
    findByKey: jest.fn().mockResolvedValue(row),
    findById: jest.fn().mockResolvedValue(row),
    isCustomerOf: jest.fn().mockResolvedValue(false),
    image: jest.fn((_u: unknown, size: string) => Promise.resolve(image(size))),
  };
  const ctrl = new MediaController(avatars as unknown as AvatarService);
  return { ctrl, avatars };
}

describe('MediaController (BE-28)', () => {
  it('review photo: public, 64 px only, cached for a year', async () => {
    const { ctrl, avatars } = setup();
    const res = fakeRes();
    await ctrl.byKey(KEY, res as unknown as Response);
    expect(avatars.image).toHaveBeenCalledWith(row, 'xs');
    expect(res.headers['Cache-Control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['Content-Type']).toBe('image/jpeg');
  });

  it('review photo: a malformed key is a 404 without a DB lookup', async () => {
    const { ctrl, avatars } = setup();
    await expect(
      ctrl.byKey('../../etc', fakeRes() as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(avatars.findByKey).not.toHaveBeenCalled();
  });

  it('own picture: md by default, private cache and ETag', async () => {
    const { ctrl, avatars } = setup();
    const res = fakeRes();
    await ctrl.mine({}, req({ id: USER_ID }), res as unknown as Response);
    expect(avatars.image).toHaveBeenCalledWith(row, 'md');
    expect(res.headers['Cache-Control']).toBe('private, max-age=86400');
    expect(res.headers.ETag).toBe(avatarEtag(KEY, 'md'));
  });

  it('own picture: a matching ETag answers 304 without fetching', async () => {
    const { ctrl, avatars } = setup();
    const res = fakeRes();
    await ctrl.mine(
      { size: 'sm' },
      req({ id: USER_ID }, avatarEtag(KEY, 'sm')),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(304);
    expect(avatars.image).not.toHaveBeenCalled();
  });

  it('no picture: 404 (the frontend shows initials)', async () => {
    const { ctrl, avatars } = setup();
    avatars.image.mockResolvedValueOnce(null as unknown as AvatarImage);
    await expect(
      ctrl.mine({}, req({ id: USER_ID }), fakeRes() as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('staff may open any user picture (sm by default)', async () => {
    const { ctrl, avatars } = setup();
    const res = fakeRes();
    await ctrl.ofUser(
      USER_ID,
      {},
      req({ id: 'staff-1', role: Role.STAFF }),
      res as unknown as Response,
    );
    expect(avatars.isCustomerOf).not.toHaveBeenCalled();
    expect(avatars.image).toHaveBeenCalledWith(row, 'sm');
  });

  it('a delivery man only sees customers of his own orders', async () => {
    const { ctrl, avatars } = setup();
    const rider = req({ id: 'rider-1', role: Role.DELIVERY_MAN });
    await expect(
      ctrl.ofUser(USER_ID, {}, rider, fakeRes() as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(avatars.image).not.toHaveBeenCalled();

    avatars.isCustomerOf.mockResolvedValueOnce(true);
    const res = fakeRes();
    await ctrl.ofUser(USER_ID, {}, rider, res as unknown as Response);
    expect(avatars.isCustomerOf).toHaveBeenLastCalledWith('rider-1', USER_ID);
    expect(res.body).toBeDefined();
  });
});

describe('withAvatarUrl (BE-28)', () => {
  const user = { ...row, email: 'a@b.test', profileImage: 'me.jpg' };

  it('drops the private fields and adds our own path', () => {
    const own = withAvatarUrl(user, 'own');
    expect(own).not.toHaveProperty('profileImagePath');
    expect(own).not.toHaveProperty('avatarKey');
    expect(own).not.toHaveProperty('profileImageFileId');
    expect(own.avatarUrl).toBe(`/media/me/avatar?size=md&v=${KEY}`);
    expect(own.email).toBe('a@b.test');
  });

  it('session user gets xs, staff lists get /media/users/<id>', () => {
    expect(withAvatarUrl(user, 'own-xs').avatarUrl).toContain('size=xs');
    expect(withAvatarUrl(user, 'staff').avatarUrl).toBe(
      `/media/users/${USER_ID}/avatar?size=sm&v=${KEY}`,
    );
  });

  it('null without a private picture', () => {
    const legacy = { id: USER_ID, profileImagePath: null, avatarKey: null };
    expect(withAvatarUrl(legacy, 'own').avatarUrl).toBeNull();
  });
});
