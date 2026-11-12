import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { FaceVerificationService } from './face-verification.service';
import { FaceCheckFailure } from './face-check';

// loosely typed: the installed axios typings predate AxiosResponse
const post = jest.spyOn(axios, 'post') as unknown as jest.Mock;

const eye = (open: number, closed: number) => ({
  no_glass_eye_open: open,
  no_glass_eye_close: closed,
  normal_glass_eye_open: 0,
  normal_glass_eye_close: 0,
});
const detected = (over: Record<string, unknown> = {}) => ({
  face_token: 'tok-1',
  attributes: {
    headpose: { yaw_angle: 4.5 },
    eyestatus: { left_eye_status: eye(97, 1), right_eye_status: eye(95, 2) },
    facequality: { value: 80, threshold: 70.1 },
    ...over,
  },
});
const faceppError = (message: string) =>
  Object.assign(new Error('Request failed'), {
    response: { status: 403, data: { error_message: message } },
  });

// SEC-04: Face++ answers -> FaceAnalysis / FaceCheckFailure / 503.
describe('FaceVerificationService', () => {
  let service: FaceVerificationService;
  const savedEnv = {
    key: process.env.FACEPP_API_KEY,
    secret: process.env.FACEPP_API_SECRET,
  };
  afterAll(() => {
    process.env.FACEPP_API_KEY = savedEnv.key;
    process.env.FACEPP_API_SECRET = savedEnv.secret;
    post.mockRestore();
  });

  beforeEach(() => {
    post.mockReset();
    post.mockRejectedValue(new Error('unexpected network call'));
    process.env.FACEPP_API_KEY = 'key';
    process.env.FACEPP_API_SECRET = 'secret';
    service = new FaceVerificationService();
  });

  it('analyze: one clear face -> token, yaw and eye state', async () => {
    post.mockResolvedValueOnce({ data: { face_num: 1, faces: [detected()] } });
    await expect(service.analyze('b64')).resolves.toEqual({
      faceToken: 'tok-1',
      yaw: 4.5,
      eyesOpen: 95,
      eyesClosed: 1,
    });
    const [url, body] = post.mock.calls[0];
    expect(url).toMatch(/\/detect$/);
    expect(String(body)).toContain(
      'return_attributes=headpose%2Ceyestatus%2Cfacequality',
    );
  });

  it.each([
    ['no face', { face_num: 0, faces: [] }, 'NO_FACE'],
    [
      'two faces',
      { face_num: 2, faces: [detected(), detected()] },
      'MANY_FACES',
    ],
    [
      'quality under the threshold',
      {
        face_num: 1,
        faces: [detected({ facequality: { value: 20, threshold: 70.1 } })],
      },
      'LOW_QUALITY',
    ],
  ])('analyze: %s -> %s', async (_label, data, reason) => {
    post.mockResolvedValueOnce({ data });
    await expect(service.analyze('b64')).rejects.toMatchObject({ reason });
  });

  it('compare: maps each side to the right Face++ field', async () => {
    post.mockResolvedValueOnce({
      data: { confidence: 81, thresholds: { '1e-5': 73.9 } },
    });
    await expect(
      service.compare({ imageUrl: 'https://signed' }, { faceToken: 'tok' }),
    ).resolves.toEqual({ confidence: 81, thresholds: { '1e-5': 73.9 } });
    const body = String(post.mock.calls[0][1]);
    expect(body).toContain('image_url1=https%3A%2F%2Fsigned');
    expect(body).toContain('face_token2=tok');
  });

  it('retries CONCURRENCY_LIMIT_EXCEEDED, then succeeds', async () => {
    jest.useFakeTimers();
    post
      .mockRejectedValueOnce(faceppError('CONCURRENCY_LIMIT_EXCEEDED'))
      .mockResolvedValueOnce({ data: { face_num: 1, faces: [detected()] } });
    const pending = service.analyze('b64');
    await jest.advanceTimersByTimeAsync(600);
    await expect(pending).resolves.toMatchObject({ faceToken: 'tok-1' });
    expect(post).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('image errors become BAD_IMAGE, other errors a 503', async () => {
    post.mockRejectedValueOnce(faceppError('IMAGE_ERROR_UNSUPPORTED_FORMAT'));
    await expect(service.analyze('b64')).rejects.toBeInstanceOf(
      FaceCheckFailure,
    );
    post.mockRejectedValueOnce(faceppError('AUTHENTICATION_ERROR'));
    await expect(service.analyze('b64')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('without API keys: 503 and no call', async () => {
    delete process.env.FACEPP_API_KEY;
    const unconfigured = new FaceVerificationService();
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.analyze('b64')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(post).not.toHaveBeenCalled();
  });
});
