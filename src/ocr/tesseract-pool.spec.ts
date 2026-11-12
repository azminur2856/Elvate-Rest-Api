import { createWorker } from 'tesseract.js';
import { OCR_IDLE_MS, TesseractPool } from './tesseract-pool';

jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }));
const mockedCreate = createWorker as jest.MockedFunction<typeof createWorker>;

// SEC-17: one shared worker, one job at a time, freed when idle.
describe('TesseractPool', () => {
  let running = 0;
  let maxParallel = 0;
  const worker = {
    recognize: jest.fn(async (img: Buffer) => {
      running++;
      maxParallel = Math.max(maxParallel, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (img.toString() === 'bad') throw new Error('unreadable');
      return { data: { text: `text:${img.toString()}` } };
    }),
    terminate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    running = 0;
    maxParallel = 0;
    mockedCreate.mockResolvedValue(worker as never);
  });

  it('shares one worker and runs jobs one at a time', async () => {
    const pool = new TesseractPool();
    const texts = await Promise.all(
      ['a', 'b', 'c'].map((t) => pool.recognize(Buffer.from(t))),
    );
    expect(texts).toEqual(['text:a', 'text:b', 'text:c']);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith('eng'); // no progress logger
    expect(maxParallel).toBe(1);
    await pool.onModuleDestroy();
  });

  it('a failing job does not block the next one', async () => {
    const pool = new TesseractPool();
    await expect(pool.recognize(Buffer.from('bad'))).rejects.toThrow(
      'unreadable',
    );
    await expect(pool.recognize(Buffer.from('ok'))).resolves.toBe('text:ok');
    await pool.onModuleDestroy();
  });

  it('frees the worker after the idle time and makes a new one later', async () => {
    jest.useFakeTimers();
    const instant = { data: { text: 'x' } };
    worker.recognize
      .mockResolvedValueOnce(instant)
      .mockResolvedValueOnce(instant);
    const pool = new TesseractPool();
    await pool.recognize(Buffer.from('a'));
    expect(worker.terminate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(OCR_IDLE_MS + 1);
    for (let i = 0; i < 5; i++) await Promise.resolve(); // let terminate() run
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await pool.recognize(Buffer.from('b'));
    expect(mockedCreate).toHaveBeenCalledTimes(2);
    await pool.onModuleDestroy();
    jest.useRealTimers();
  });
});
