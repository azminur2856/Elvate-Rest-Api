/**
 * sharp >= 0.35 ships ES-module-first type declarations. With this project's
 * CommonJS build (classic `node` module resolution) TypeScript reads
 * `index.d.mts` (`export default sharp`), while `require('sharp')` at runtime
 * returns the sharp function itself. This file bridges the two in one place:
 * import sharp from here, not from 'sharp'.
 */
import type sharpDefault from 'sharp';

export type { Metadata, Sharp, SharpOptions } from 'sharp';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof sharpDefault;

export default sharp;
