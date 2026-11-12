/** Shared types + pure rules for the Face++ checks (SEC-04). */

export type FaceAction = 'TURN_HEAD' | 'BLINK';
export const FACE_ACTIONS: FaceAction[] = ['TURN_HEAD', 'BLINK'];

export const FACE_ACTION_PROMPTS: Record<FaceAction, string> = {
  TURN_HEAD: 'Look at the camera, then turn your head to one side.',
  BLINK: 'Look at the camera, then close your eyes for a moment.',
};

/** Why a photo was refused. Login maps all of them to one generic answer. */
export type FaceCheckReason =
  | 'NO_FACE'
  | 'MANY_FACES'
  | 'LOW_QUALITY'
  | 'NOT_FRONTAL'
  | 'EYES_CLOSED'
  | 'BAD_IMAGE';

export const FACE_CHECK_MESSAGES: Record<FaceCheckReason, string> = {
  NO_FACE: 'No face was found in the photo.',
  MANY_FACES: 'More than one face is in the photo. Only you should be in it.',
  LOW_QUALITY:
    'The photo is too blurry or too dark. Try again in better light.',
  NOT_FRONTAL: 'Look straight at the camera.',
  EYES_CLOSED: 'Keep your eyes open and remove dark glasses.',
  BAD_IMAGE: 'The photo could not be read.',
};

export class FaceCheckFailure extends Error {
  constructor(readonly reason: FaceCheckReason) {
    super(FACE_CHECK_MESSAGES[reason]);
  }
}

export interface FaceAnalysis {
  faceToken: string;
  /** Head turn left/right in degrees (0 = facing the camera). */
  yaw: number;
  /** 0-100: how sure Face++ is that both eyes are open / closed. */
  eyesOpen: number;
  eyesClosed: number;
}

export type MatchLevel = '1e-3' | '1e-4' | '1e-5';

export interface FaceMatch {
  /** 0-100; undefined when Face++ found no face on one side. */
  confidence?: number;
  /** Confidence needed for a false-accept rate of 1e-3 / 1e-4 / 1e-5. */
  thresholds?: Partial<Record<MatchLevel, number>>;
}

/** Strictest level by default: about 1 false accept in 100 000. */
export function isMatch(m: FaceMatch, level: MatchLevel = '1e-5'): boolean {
  const needed = m.thresholds?.[level];
  return (
    typeof m.confidence === 'number' &&
    typeof needed === 'number' &&
    m.confidence >= needed
  );
}

export const LIVENESS = {
  /** The first ("look at the camera") frame must be roughly frontal. */
  neutralMaxYaw: 15,
  /** A head turn must reach this angle and move at least `turnMinDelta`. */
  turnMinYaw: 20,
  turnMinDelta: 15,
  /** Eye-state probabilities (0-100). */
  eyesOpenMin: 50,
  eyesClosedMin: 50,
};

/**
 * Did the person do what the random prompt asked between the two frames?
 * Head turns accept either side: browsers mirror the selfie preview, so
 * "left" is ambiguous; the random choice between turning and blinking
 * still defeats a single replayed photo.
 */
export function performedAction(
  action: FaceAction,
  neutral: FaceAnalysis,
  acted: FaceAnalysis,
): boolean {
  if (Math.abs(neutral.yaw) > LIVENESS.neutralMaxYaw) return false;
  if (action === 'TURN_HEAD') {
    return (
      Math.abs(acted.yaw) >= LIVENESS.turnMinYaw &&
      Math.abs(acted.yaw - neutral.yaw) >= LIVENESS.turnMinDelta
    );
  }
  return (
    neutral.eyesOpen >= LIVENESS.eyesOpenMin &&
    acted.eyesClosed >= LIVENESS.eyesClosedMin
  );
}
