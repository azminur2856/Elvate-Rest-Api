import { sharpInput } from 'src/common/image-input';
import { FaceCheckFailure } from 'src/users/services/face-check';

/** Longest edge sent to Face++ (detect works best between 200 and 1000 px). */
export const FACE_PHOTO_EDGE = 640;

/**
 * Camera photo -> upright JPEG of at most 640 px, ready for Face++ and for
 * storing as a reference. Unreadable input -> FaceCheckFailure('BAD_IMAGE').
 */
export async function faceJpeg(photo: Buffer): Promise<Buffer> {
  try {
    return await sharpInput(photo)
      .rotate() // apply the camera's EXIF orientation
      .resize(FACE_PHOTO_EDGE, FACE_PHOTO_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new FaceCheckFailure('BAD_IMAGE');
  }
}
