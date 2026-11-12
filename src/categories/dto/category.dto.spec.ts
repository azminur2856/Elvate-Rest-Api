import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { fromImgPath, toImgPath } from 'src/common/media';

const errorsFor = async (imageUrl: unknown) => {
  const dto = plainToInstance(UpdateCategoryDto, { imageUrl });
  return (await validate(dto)).map((e) => e.property);
};

describe('category imageUrl (BE-28)', () => {
  it('accepts a full URL, the /img/ path the API returned, or null', async () => {
    expect(
      await errorsFor('https://ik.imagekit.io/shop/categories/c.png'),
    ).toEqual([]);
    expect(await errorsFor('/img/categories/c.png')).toEqual([]);
    expect(await errorsFor(null)).toEqual([]);
  });

  it('rejects anything else', async () => {
    for (const bad of ['not a url', '/img/../etc/passwd', '/other/c.png', 42]) {
      expect(await errorsFor(bad)).toEqual(['imageUrl']);
    }
    const create = plainToInstance(CreateCategoryDto, {
      name: 'Hats',
      imageUrl: 'ftp//nope',
    });
    expect((await validate(create)).map((e) => e.property)).toEqual([
      'imageUrl',
    ]);
  });

  describe('stored as the full URL', () => {
    const saved = process.env.IMAGEKIT_URL_ENDPOINT;
    beforeAll(() => {
      process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/shop123/';
    });
    afterAll(() => {
      process.env.IMAGEKIT_URL_ENDPOINT = saved;
    });

    it('turns an /img/ path back into the ImageKit URL', () => {
      expect(fromImgPath('/img/categories/c.png')).toBe(
        'https://ik.imagekit.io/shop123/categories/c.png',
      );
    });

    it('leaves full URLs and empty values alone', () => {
      const url = 'https://example.com/c.png';
      expect(fromImgPath(url)).toBe(url);
      expect(fromImgPath(null)).toBeNull();
      expect(fromImgPath(undefined)).toBeUndefined();
    });

    it('round-trips with toImgPath', () => {
      const stored = 'https://ik.imagekit.io/shop123/categories/c.png';
      expect(fromImgPath(toImgPath(stored))).toBe(stored);
    });
  });
});
