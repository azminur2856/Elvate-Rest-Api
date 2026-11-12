import { BadRequestException } from '@nestjs/common';
import {
  ActivityLogsService,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXPORT_ROWS,
  csvCell,
} from './activity-logs.service';
import { ActivityType } from './enums/activity-type.enum';

// SEC-16: CSV export safety.
describe('csvCell', () => {
  it.each([
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
    ['+1+1', "'+1+1"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tcmd', "'\tcmd"],
  ])('neutralises the formula %p', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('keeps normal text, numbers and RFC 4180 quoting', () => {
    expect(csvCell('Test Buyer')).toBe('Test Buyer');
    expect(csvCell(-5)).toBe('-5'); // numbers are not text a user typed
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('ActivityLogsService limits', () => {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: object) => v),
    save: jest.fn((v: object) => Promise.resolve({ id: 1, ...v })),
  };
  const service = new ActivityLogsService(repo as never);

  it(`refuses an export of more than ${MAX_EXPORT_ROWS} rows`, async () => {
    qb.getMany.mockResolvedValueOnce(
      Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => ({ id: i })),
    );
    await expect(service.exportLogsToCSV({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(qb.take).toHaveBeenCalledWith(MAX_EXPORT_ROWS + 1);
  });

  it(`stores at most ${MAX_DESCRIPTION_LENGTH} characters of description`, async () => {
    await service.createActivityLog({
      activity: ActivityType.USER_LOGIN,
      description: 'x'.repeat(5000),
    });
    const saved = repo.create.mock.calls[0][0] as { description: string };
    expect(saved.description).toHaveLength(MAX_DESCRIPTION_LENGTH);
  });
});
