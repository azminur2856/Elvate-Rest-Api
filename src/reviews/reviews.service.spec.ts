import { displayName } from './reviews.service';
import { Users } from 'src/users/entities/users.entity';

const user = (firstName: string, lastName?: string) =>
  ({ firstName, lastName }) as Users;

describe('review author names', () => {
  it('public pages show the first name and the last initial', () => {
    expect(displayName(user('Rahim', 'khan'), 'public')).toBe('Rahim K.');
    expect(displayName(user('Rahim'), 'public')).toBe('Rahim');
  });

  it('the owner and moderators see the full name', () => {
    expect(displayName(user('Rahim', 'Khan'), 'full')).toBe('Rahim Khan');
    expect(displayName(user(''), 'full')).toBe('Customer');
  });
});
