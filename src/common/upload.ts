import { BadRequestException } from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export const MB = 1024 * 1024;

/**
 * Ceilings for every single-file multipart route (SEC-02). Files are kept in
 * memory, so without these one request could exhaust the 512 MB Render box.
 * Multer errors become 413 (file too large) or 400 (too many files / fields).
 */
export const UPLOAD_LIMITS = {
  fileSize: 10 * MB,
  files: 1,
  fieldSize: 64 * 1024,
  fields: 10,
  parts: 11,
} as const;

/** Photo types the face routes accept (Face++ and sharp read all three). */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Options for the face photo field `liveImage`. */
export const FACE_PHOTO_UPLOAD: SingleFileUploadOptions = {
  mimeTypes: PHOTO_MIME_TYPES,
  typeError: 'Only JPG, PNG or WebP photos are allowed.',
};

export const NO_FACE_PHOTO = 'No photo uploaded (multipart field "liveImage").';

export interface SingleFileUploadOptions {
  /** Upper bound in bytes; never above `UPLOAD_LIMITS.fileSize`. */
  maxBytes?: number;
  /** Allowed MIME types; omit to leave the type check to the route. */
  mimeTypes?: readonly string[];
  /** 400 message when the type is not allowed. */
  typeError?: string;
}

/** `FileInterceptor` with memory storage and the SEC-02 limits. */
export function SingleFileUpload(
  field: string,
  options: SingleFileUploadOptions = {},
) {
  const fileSize = Math.min(
    options.maxBytes ?? UPLOAD_LIMITS.fileSize,
    UPLOAD_LIMITS.fileSize,
  );
  return FileInterceptor(field, {
    storage: memoryStorage(),
    limits: { ...UPLOAD_LIMITS, fileSize },
    fileFilter: (_req, file, cb) => {
      if (!options.mimeTypes || options.mimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(
        new BadRequestException(
          options.typeError ?? 'This file type is not allowed.',
        ),
        false,
      );
    },
  });
}

/**
 * One photo per named field (e.g. the two face-login frames), each under the
 * SEC-02 limits and of a photo type (JPG, PNG or WebP).
 */
export function PhotoFieldsUpload(fields: string[]) {
  return FileFieldsInterceptor(
    fields.map((name) => ({ name, maxCount: 1 })),
    {
      storage: memoryStorage(),
      limits: {
        ...UPLOAD_LIMITS,
        files: fields.length,
        parts: fields.length + UPLOAD_LIMITS.fields,
      },
      fileFilter: (_req, file, cb) => {
        if (PHOTO_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException(FACE_PHOTO_UPLOAD.typeError), false);
      },
    },
  );
}
