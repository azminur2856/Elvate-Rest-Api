import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import { SubscriptionService } from 'src/subscription/subscription.service';
import * as Tesseract from 'tesseract.js';
import * as sharp from 'sharp'; // npm install sharp
//import { Rembg } from 'rembg-node';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { UsersService } from 'src/users/users.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';

export interface EditOptions {
  crop?: { left: number; top: number; width: number; height: number };
  resize?: { width: number; height: number };
  rotate?: number; // degrees
  brightness?: number; // 0.0 - 2.0 (1 is normal)
  contrast?: number; // 0.0 - 2.0 (1 is normal)
  grayscale?: boolean;
  flip?: boolean;
  flop?: boolean;
  blur?: number; // sigma > 0.3
}

@Injectable()
export class OcrService {
  constructor(
    private readonly activityLogService: ActivityLogsService,
    private usersService: UsersService,
    private subscriptionService: SubscriptionService,
  ) {}
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

    //Add activity log for PDF text extraction
    await this.activityLogService.createActivityLog({
      activity: ActivityType.OCR_EXTRACT_TEXT_FROM_PDF,
      description: `User ${userId} extracted text from a PDF document.`,
      user: user,
    });
    const data = await pdfParse(buffer);
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
    // Add activity log for image text extraction
    await this.activityLogService.createActivityLog({
      activity: ActivityType.OCR_EXTRACT_TEXT_FROM_IMAGE,
      description: `User ${userId} extracted text from an image.`,
      user: user,
    });

    // Use Tesseract.js to extract text from image
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m), // Optional progress log
    });
    return { text: result.data.text.trim() };
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

    // Add activity log for image resizing
    await this.activityLogService.createActivityLog({
      activity: ActivityType.RESIZE_IMAGE,
      description: `User ${userId} resized an image to ${width}x${height}.`,
      user: user,
    });

    // Use sharp to resize
    const resized = await sharp(buffer)
      .resize(width, height)
      .toFormat('jpeg')
      .toBuffer();

    // Convert to base64 string for frontend
    return {
      data: resized.toString('base64'),
      contentType: 'image/jpeg',
    };
  }

  // async removeBackground(buffer: Buffer, mimetype: string, userId: string) {
  //   // 1. Check subscription
  //   const status = await this.subscriptionService.getSubscriptionStatus(userId);
  //   if (!status.isSubscribed) {
  //     throw new ForbiddenException(
  //       'You must be subscribed to use this feature.',
  //     );
  //   }

  //   // 2. Check user existence
  //   const user = await this.usersService.findOne(userId);
  //   if (!user) {
  //     throw new BadRequestException('User not found');
  //   }

  //   // Add activity log for background removal
  //   await this.activityLogService.createActivityLog({
  //     activity: ActivityType.REMOVE_BACKGROUND,
  //     description: `User ${userId} removed background from an image.`,
  //     user: user,
  //   });

  //   // 2. Validate file type
  //   // Accepts: jpg, jpeg, png, heic (HEIC may require sharp@latest)
  //   if (!/^image\/(jpeg|png|jpg|heic)$/i.test(mimetype)) {
  //     throw new BadRequestException(
  //       'Only JPG, JPEG, PNG, or HEIC images are allowed.',
  //     );
  //   }

  //   // 3. Remove background
  //   try {
  //     const rembg = new Rembg();
  //     // Convert buffer to Sharp instance before removing background
  //     const sharpImage = sharp(buffer);
  //     // `remove` returns a PNG buffer with transparent background
  //     const resultSharp = await rembg.remove(sharpImage);
  //     const outputBuffer = await resultSharp.png().toBuffer(); // Always return buffer
  //     return outputBuffer;
  //   } catch (err) {
  //     // Optionally log the error
  //     throw new BadRequestException(
  //       'Failed to process image for background removal.',
  //     );
  //   }
  // }

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

    let image = sharp(buffer);

    // Crop
    if (options.crop) {
      image = image.extract(options.crop);
    }

    // Resize
    if (options.resize) {
      image = image.resize(options.resize.width, options.resize.height);
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
    } catch (err) {
      throw new BadRequestException('Image processing failed');
    }
  }
}
