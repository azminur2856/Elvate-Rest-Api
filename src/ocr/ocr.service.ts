import {
  BadRequestException,
  ForbiddenException,
  Inject,
  ServiceUnavailableException,
  Injectable,
} from '@nestjs/common';
import {
  BACKGROUND_REMOVER,
  BackgroundRemover,
} from './background/background-remover';
import * as pdfParse from 'pdf-parse';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { UsersService } from 'src/users/users.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { MAX_EDGE, type EditOptionsDto } from './dto/edit-image.dto';
import { openImage } from 'src/common/image-input';
import { TesseractPool } from './tesseract-pool';

/** SEC-17: pages of a PDF that are read for text. */
export const MAX_PDF_PAGES = 20;

/** pdf-parse ships no type declarations; this is the part we use. */
const parsePdf = pdfParse as unknown as (
  data: Buffer,
  options: { max: number },
) => Promise<{ text: string }>;

/** A damaged, encrypted or non-PDF upload: a 400, not a 500. */
export const PDF_UNREADABLE =
  "We couldn't read this PDF. It may be damaged or password-protected. Try another file.";

/** Validated edit options (see `EditOptionsDto` for the limits). */
export type EditOptions = EditOptionsDto;

@Injectable()
export class OcrService {
  constructor(
    private readonly activityLogService: ActivityLogsService,
    private usersService: UsersService,
    private subscriptionService: SubscriptionService,
    @Inject(BACKGROUND_REMOVER) private readonly remover: BackgroundRemover,
    private readonly tesseract: TesseractPool,
  ) {}

  /** BE-21: subscribed users only; PNG with a transparent background, as base64. */
  async removeBackground(
    file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname'>,
    userId: string,
  ): Promise<{ contentType: 'image/png'; data: string }> {
    const status = await this.subscriptionService.getSubscriptionStatus(userId);
    if (!status.isSubscribed) {
      throw new ForbiddenException(
        'You must be subscribed to use this feature.',
      );
    }
    if (!this.remover.isConfigured()) {
      throw new ServiceUnavailableException(
        'Background removal is not available right now (the provider is not configured)',
      );
    }
    const user = await this.usersService.findOne(userId);
    if (!user) throw new BadRequestException('User not found');
    // real type + size check before spending a remove.bg call on it
    await openImage(file.buffer);

    const png = await this.remover.remove(
      file.buffer,
      file.mimetype,
      file.originalname || 'image',
    );
    await this.activityLogService.createActivityLog({
      activity: ActivityType.REMOVE_BACKGROUND,
      description: `User ${userId} removed the background from an image.`,
      user,
    });
    return { contentType: 'image/png', data: png.toString('base64') };
  }
  async extractTextFromPdf(
    buffer: Buffer,
    userId: string,
  ): Promise<{ text: string }> {
    const status = await this.subscriptionService.getSubscriptionStatus(userId);
    if (!status.isSubscribed) {
      throw new ForbiddenException(
        'You must be subscribed to use this feature.',
      );
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // SEC-17: a 5 000-page PDF must not be parsed in full on a small server
    let data: { text: string };
    try {
      data = await parsePdf(buffer, { max: MAX_PDF_PAGES });
    } catch {
      throw new BadRequestException(PDF_UNREADABLE);
    }

    // Activity log only for a PDF that was actually read
    await this.activityLogService.createActivityLog({
      activity: ActivityType.OCR_EXTRACT_TEXT_FROM_PDF,
      description: `User ${userId} extracted text from a PDF document.`,
      user: user,
    });
    return { text: data.text.trim() };
  }

  async extractTextFromImage(
    buffer: Buffer,
    userId: string,
  ): Promise<{ text: string }> {
    const status = await this.subscriptionService.getSubscriptionStatus(userId);
    if (!status.isSubscribed) {
      throw new ForbiddenException(
        'You must be subscribed to use this feature.',
      );
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    // tesseract decodes on its own: refuse non-images and pixel bombs first
    await openImage(buffer);
    // Add activity log for image text extraction
    await this.activityLogService.createActivityLog({
      activity: ActivityType.OCR_EXTRACT_TEXT_FROM_IMAGE,
      description: `User ${userId} extracted text from an image.`,
      user: user,
    });

    // SEC-17: the shared, queued worker (no per-request worker, no progress log)
    const text = await this.tesseract.recognize(buffer);
    return { text: text.trim() };
  }

  async resizeImage(
    buffer: Buffer,
    width: number,
    height: number,
    contentType: string,
    userId: string,
  ): Promise<{ data: string; contentType: string }> {
    const status = await this.subscriptionService.getSubscriptionStatus(userId);
    if (!status.isSubscribed) {
      throw new ForbiddenException(
        'You must be subscribed to use this feature.',
      );
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const { image } = await openImage(buffer);

    // Add activity log for image resizing
    await this.activityLogService.createActivityLog({
      activity: ActivityType.RESIZE_IMAGE,
      description: `User ${userId} resized an image to ${width}x${height}.`,
      user: user,
    });

    let resized: Buffer;
    try {
      resized = await image.resize(width, height).jpeg().toBuffer();
    } catch {
      throw new BadRequestException('Image processing failed');
    }

    // Convert to base64 string for frontend
    return {
      data: resized.toString('base64'),
      contentType: 'image/jpeg',
    };
  }

  async editImage(
    buffer: Buffer,
    options: EditOptions,
    userId: string,
  ): Promise<Buffer> {
    // 1. Check subscription
    const status = await this.subscriptionService.getSubscriptionStatus(userId);
    if (!status.isSubscribed) {
      throw new ForbiddenException(
        'You must be subscribed to use this feature.',
      );
    }

    const opened = await openImage(buffer);
    let image = opened.image;

    // Crop (must stay inside the picture)
    if (options.crop) {
      const { left, top, width, height } = options.crop;
      if (left + width > opened.width || top + height > opened.height) {
        throw new BadRequestException(
          `crop must stay inside the ${opened.width}x${opened.height} image`,
        );
      }
      image = image.extract({ left, top, width, height });
    }

    // Resize; without one, still cap the output at MAX_EDGE per side
    if (options.resize) {
      image = image.resize(options.resize.width, options.resize.height);
    } else {
      image = image.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Rotate
    if (options.rotate !== undefined) {
      image = image.rotate(options.rotate);
    }

    // Brightness
    if (options.brightness !== undefined) {
      image = image.modulate({
        brightness: options.brightness,
      });
    }

    // Contrast
    if (options.contrast !== undefined) {
      // sharp does not have direct contrast, but linear(a, b) can be used: a = contrast, b = -128 * (contrast - 1)
      // For contrast=1, a=1, b=0 (no change)
      // For contrast>1, increases contrast; <1 decreases
      const contrast = options.contrast;
      image = image.linear(contrast, -(128 * (contrast - 1)));
    }

    // Grayscale
    if (options.grayscale) {
      image = image.grayscale();
    }

    // Flip
    if (options.flip) {
      image = image.flip();
    }

    // Flop
    if (options.flop) {
      image = image.flop();
    }

    // Blur
    if (options.blur !== undefined && options.blur >= 0.3) {
      image = image.blur(options.blur);
    }

    // 2. Check user existence
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Add activity log for image editing
    await this.activityLogService.createActivityLog({
      activity: ActivityType.EDIT_IMAGE,
      description: `User ${userId} edited an image with options: ${JSON.stringify(
        options,
      )}.`,
      user: user,
    });

    // Return result as Buffer (default: PNG)
    try {
      return await image.png().toBuffer();
    } catch {
      throw new BadRequestException('Image processing failed');
    }
  }
}
