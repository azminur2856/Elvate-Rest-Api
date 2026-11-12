import { FaceAnalysis, LIVENESS, isMatch, performedAction } from './face-check';

const face = (over: Partial<FaceAnalysis> = {}): FaceAnalysis => ({
  faceToken: 't',
  yaw: 0,
  eyesOpen: 95,
  eyesClosed: 2,
  ...over,
});

// SEC-04: the decisions face login is built on.
describe('isMatch', () => {
  const thresholds = { '1e-3': 62.3, '1e-4': 69.1, '1e-5': 73.9 };

  it('uses the strict 1e-5 threshold by default', () => {
    expect(isMatch({ confidence: 74, thresholds })).toBe(true);
    expect(isMatch({ confidence: 73.8, thresholds })).toBe(false);
  });

  it('accepts a looser level when asked', () => {
    expect(isMatch({ confidence: 70, thresholds }, '1e-4')).toBe(true);
    expect(isMatch({ confidence: 70, thresholds })).toBe(false);
  });

  it('is false when Face++ found no face (no confidence / thresholds)', () => {
    expect(isMatch({})).toBe(false);
    expect(isMatch({ confidence: 99 })).toBe(false);
    expect(isMatch({ thresholds })).toBe(false);
  });
});

describe('performedAction (liveness)', () => {
  it('TURN_HEAD: frontal first, then a clear turn to either side', () => {
    expect(performedAction('TURN_HEAD', face(), face({ yaw: 30 }))).toBe(true);
    expect(performedAction('TURN_HEAD', face(), face({ yaw: -28 }))).toBe(true);
  });

  it('TURN_HEAD: a small turn is not enough', () => {
    expect(performedAction('TURN_HEAD', face(), face({ yaw: 12 }))).toBe(false);
    // reaches the angle but barely moved from an already-turned start
    expect(
      performedAction('TURN_HEAD', face({ yaw: 14 }), face({ yaw: 22 })),
    ).toBe(false);
  });

  it('BLINK: eyes open, then closed', () => {
    expect(performedAction('BLINK', face(), face({ eyesClosed: 90 }))).toBe(
      true,
    );
    expect(
      performedAction('BLINK', face(), face({ eyesClosed: 30, eyesOpen: 60 })),
    ).toBe(false);
    // eyes never open (e.g. dark glasses) cannot prove a blink
    expect(
      performedAction(
        'BLINK',
        face({ eyesOpen: 10 }),
        face({ eyesClosed: 90 }),
      ),
    ).toBe(false);
  });

  it('the first frame must face the camera for either prompt', () => {
    const turned = face({ yaw: LIVENESS.neutralMaxYaw + 1 });
    expect(performedAction('TURN_HEAD', turned, face({ yaw: 40 }))).toBe(false);
    expect(performedAction('BLINK', turned, face({ eyesClosed: 90 }))).toBe(
      false,
    );
  });

  it('a replayed still photo (same frame twice) fails both prompts', () => {
    const still = face();
    expect(performedAction('TURN_HEAD', still, still)).toBe(false);
    expect(performedAction('BLINK', still, still)).toBe(false);
  });
});
