import { BadRequestException } from '@nestjs/common';
import { parseEditOptions } from './edit-image.dto';

// SEC-03: the "options" JSON of POST /ocr/image/edit is untrusted input.
describe('parseEditOptions', () => {
  const reasons = (raw: unknown): string[] => {
    try {
      parseEditOptions(raw);
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const msg = (e as BadRequestException).getResponse() as {
        message: string | string[];
      };
      return ([] as string[]).concat(msg.message);
    }
    throw new Error('expected a 400');
  };

  it('accepts a normal edit and keeps the values', () => {
    const opts = parseEditOptions(
      JSON.stringify({
        crop: { left: 0, top: 0, width: 100, height: 50 },
        resize: { width: 64, height: 64 },
        rotate: -90,
        brightness: 1.2,
        contrast: 0.8,
        grayscale: true,
        flip: false,
        flop: true,
        blur: 3,
      }),
    );
    expect(opts.crop).toEqual({ left: 0, top: 0, width: 100, height: 50 });
    expect(opts.rotate).toBe(-90);
    expect(opts.blur).toBe(3);
  });

  it('accepts an empty object (no edits)', () => {
    expect(parseEditOptions('{}')).toEqual({});
  });

  it.each([undefined, '', 'not json', '[]', '42', 'null'])(
    'rejects %p as not a JSON object',
    (raw) => {
      expect(reasons(raw)).toEqual(['options must be a JSON object']);
    },
  );

  it('caps resize and crop at 4096 px', () => {
    expect(
      reasons('{"resize":{"width":100000,"height":10}}').join(' | '),
    ).toMatch(
      /resize\.width must not be greater than 4096.*resize\.height must not be less than 16/,
    );
    expect(
      reasons('{"crop":{"left":0,"top":0,"width":5000,"height":10}}'),
    ).toEqual(['crop.width must not be greater than 4096']);
  });

  it('rejects odd rotations, big blurs and out-of-range tones', () => {
    const all = reasons(
      '{"rotate":45,"blur":21,"brightness":3,"contrast":-1}',
    ).join(' | ');
    expect(all).toContain('rotate must be a multiple of 90');
    expect(all).toContain('blur must not be greater than 20');
    expect(all).toContain('brightness must not be greater than 2');
    expect(all).toContain('contrast must not be less than 0');
  });

  it('rejects unknown keys and wrong types', () => {
    expect(reasons('{"evil":1}')).toEqual(['property evil should not exist']);
    expect(reasons('{"grayscale":"yes"}')).toEqual([
      'grayscale must be a boolean value',
    ]);
    expect(
      reasons('{"crop":{"left":1.5,"top":0,"width":1,"height":1}}'),
    ).toEqual(['crop.left must be an integer number']);
  });
});
