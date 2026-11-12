import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MailService } from './mail.services';
import { escapeHtml } from 'src/common/html';
import { CreateUserDto, MAX_NAME_LENGTH } from 'src/users/dto/create-user.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';

// SEC-15: names are untrusted text inside HTML e-mails.
describe('escapeHtml', () => {
  it('escapes the five HTML-special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('MailService templates', () => {
  const service = Object.create(MailService.prototype) as MailService;
  const send = jest.fn().mockResolvedValue({ accepted: ['x'], rejected: [] });
  Object.assign(service, { send, FRONTEND_URL: 'https://shop.example' });
  const evil = '<a href="https://evil.example">Click</a>';

  beforeEach(() => send.mockClear());

  const htmlOf = () => send.mock.calls[0][3] as string;

  it.each([
    ['welcome', () => service.sendWelcomeEmail('a@b.co', evil)],
    [
      'registration',
      () => service.sendRegistrationVerificationEmail('a@b.co', evil, 'tok'),
    ],
    [
      'password reset',
      () => service.sendPasswordResetEmail('a@b.co', evil, 't'),
    ],
    [
      'notification',
      () => service.sendNotificationEmail('a@b.co', evil, 'Subject', 'Body'),
    ],
    [
      'order',
      () =>
        service.sendOrderEmail(
          'a@b.co',
          evil,
          'S',
          'Heading',
          '<p>x</p>',
          'o1',
        ),
    ],
  ])('%s e-mail shows the name as text, never as HTML', async (_l, sendIt) => {
    await sendIt();
    expect(htmlOf()).toContain('Hello &lt;a href=&quot;https://evil.example');
    expect(htmlOf()).not.toContain(evil);
  });
});

describe('name length (DTOs)', () => {
  const tooLong = 'A'.repeat(MAX_NAME_LENGTH + 1);
  const ok = 'A'.repeat(MAX_NAME_LENGTH);
  const props = async (cls: new () => object, plain: object) =>
    (await validate(plainToInstance(cls, plain))).map((e) => e.property);

  it('sign-up refuses names over 50 characters', async () => {
    const base = { email: 'a@b.co', password: 'Test@12345' };
    expect(await props(CreateUserDto, { ...base, firstName: ok })).toEqual([]);
    expect(
      await props(CreateUserDto, {
        ...base,
        firstName: tooLong,
        lastName: tooLong,
      }),
    ).toEqual(['firstName', 'lastName']);
  });

  it('profile edits refuse names over 50 characters', async () => {
    expect(await props(UpdateUserDto, { firstName: ok })).toEqual([]);
    expect(await props(UpdateUserDto, { lastName: tooLong })).toEqual([
      'lastName',
    ]);
  });
});
