import { isInsideDhaka } from './addresses.service';

describe('isInsideDhaka (drives the shipping fee)', () => {
  it.each(['Dhaka', 'dhaka', ' DHAKA ', 'Dhaka North', 'dhaka city'])(
    '%s is inside Dhaka',
    (city) => expect(isInsideDhaka(city)).toBe(true),
  );

  it.each(['Chattogram', 'Gazipur', 'Dhakaria', 'Sylhet'])(
    '%s is outside Dhaka',
    (city) => expect(isInsideDhaka(city)).toBe(false),
  );
});
