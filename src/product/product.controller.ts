import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Request,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create_product.dto';
import { UpdateProductDto } from './dto/update_product.dto';
import { CreateProductVariantDto } from './dto/create_product_variant';
import { ProductVariantService } from './product_variant.service';
import { UpdateProductVariantDto } from './dto/update_product_variant.dto';
import { ProductImageService } from './product_image.service';
import { UpdateProductImageDto } from './dto/update_product_image.dto';
import { CreateProductImageDto } from './dto/create_product_image.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import axios from 'axios';
import * as fs from 'fs';
import { JwtWithBlacklistGuard } from 'src/auth/CustomGuard/jwt_blacklist.guard';
// import Replicate from 'replicate';
// import * as Replicate from 'replicate';
const Replicate = require('replicate');

interface ReplicateOutputItem {
  label: string;
  confidence: number;
}

// Initialize Replicate client with your API token
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // API token from Replicate
});

// const replicate = new Replicate({
//   auth:
//     process.env.REPLICATE_API_TOKEN,
// });

@Controller('product')
export class ProductController {
  constructor(
    private productService: ProductService,
    private productVariantService: ProductVariantService,
    private productImageService: ProductImageService,
  ) {}

  @Get()
  async findAllProduct() {
    return this.productService.findAllProduct();
    // return 'check get';
  }

  @UseGuards(JwtWithBlacklistGuard)
  // @UseGuards(AuthGuard('jwt'))
  @Post()
  async createProduct(@Request() req, @Body() body: CreateProductDto) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can create products');
    }

    return this.productService.createProduct(body, req.user); // pass user info
  }

  // @UseGuards(AuthGuard('jwt'))
  // @Post()
  // async createProduct(@Request() req, @Body() body: CreateProductDto) {
  //   if (req.user.role !== 'admin') {
  //     throw new Error('Only admin can create products');
  //   }

  //   // const adminId = req.user.id; // 👈 get admin id from the JWT
  //   const adminId = Number(req.user.id);

  //   return this.productService.createProduct({
  //     ...body,
  //     created_by: adminId, // 👈 inject admin id into product creation
  //   });
  // }

  @Get('variant')
  async showAllProductVariant() {
    return this.productVariantService.showAllProductVariant();
  }

  @Get('image')
  async showAllProductImages() {
    return await this.productImageService.showAllProductImages();
  }

  @Get(':id')
  async findOneProduct(@Param('id') id: number) {
    return this.productService.findOneProduct(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updateProduct(
    @Request() req,
    @Param('id') id: number,
    @Body() body: UpdateProductDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can update products');
    }

    return this.productService.updateProduct(id, body, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async removeProduct(@Request() req, @Param('id') id: number) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can delete products');
    }
    return this.productService.removeProduct(id, req.user);
  }

  @Get('variant/:id')
  async findOneProductVariant(@Param('id') id: number) {
    return await this.productVariantService.findOneProductVariant(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('variant')
  async createProductVariant(
    @Request() req,
    @Body() body: CreateProductVariantDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can create product variants');
    }
    return await this.productVariantService.createProductVariant(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('variant/:id')
  async updateProductVariant(
    @Request() req,
    @Param('id') id: number,
    @Body() body: UpdateProductVariantDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can update product variants');
    }
    return await this.productVariantService.updateProductVariant(id, body);
  }

  // @UseGuards(AuthGuard('jwt'))
  // @Post('image')
  // async createProductImage(
  //   @Request() req,
  //   @Body() body: CreateProductImageDto,
  // ) {
  //   if (req.user.role !== 'admin') {
  //     throw new ForbiddenException('Only admin can upload product images');
  //   }
  //   return await this.productImageService.createProductImage(body);
  // }

  // @Post('image')
  // @UseGuards(AuthGuard('jwt'))
  // @UseInterceptors(
  //   FileInterceptor('file', {
  //     storage: diskStorage({
  //       destination: './uploads/images',
  //       filename: (req, file, callback) => {
  //         const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  //         const ext = extname(file.originalname); // e.g., .jpg or .png
  //         const fileName = `${uniqueSuffix}${ext}`;
  //         callback(null, fileName);
  //       },
  //     }),
  //   }),
  // )
  // async uploadProductImage(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body()
  //   body: {
  //     product_id: number;
  //     variant_id: number;
  //     is_main: boolean;
  //   },
  //   @Request() req,
  // ) {
  //   if (req.user.role !== 'admin') {
  //     throw new ForbiddenException('Only admin can upload product images');
  //   }

  //   const image_url = `/uploads/images/${file.filename}`;
  //   return this.productImageService.createProductImage({
  //     ...body,
  //     image_url,
  //   });
  // }

  // @Post('image')
  // @UseGuards(AuthGuard('jwt'))
  // @UseInterceptors(
  //   FileInterceptor('file', {
  //     storage: diskStorage({
  //       destination: './uploads/images',
  //       filename: (req, file, callback) => {
  //         const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  //         const ext = extname(file.originalname);
  //         const fileName = `${uniqueSuffix}${ext}`;
  //         callback(null, fileName);
  //       },
  //     }),
  //   }),
  // )
  // async uploadProductImage(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body() body: { product_id: number; variant_id: number; is_main: boolean },
  //   @Request() req,
  // ) {
  //   if (req.user.role !== 'admin') {
  //     throw new ForbiddenException('Only admin can upload product images');
  //   }

  //   // Read file and convert to base64
  //   const filePath = file.path;
  //   const fileBuffer = fs.readFileSync(filePath);
  //   const base64 = `data:image/${extname(file.originalname).replace('.', '')};base64,${fileBuffer.toString('base64')}`;

  //   // Send to Replicate for AI verification using Replicate client
  //   try {
  //     const output = await replicate.run(
  //       'yorickvp/llava-13b:80537f9eead1a5bfa72d5ac6ea6414379be41d4d4f6679fd776e9535d1eb58bb',
  //       {
  //         input: {
  //           image: base64,
  //           prompt: 'What is happening in this image?',
  //         },
  //       },
  //     );

  //     // Log the entire output to see its structure
  //     console.log('Replicate API Output:', output);

  //     // Assuming output is an array or object containing caption-like data
  //     // Adjust this based on the actual format from Replicate
  //     let caption = '';

  //     // Example: Check if the output is an array of objects with a `text` field (or similar)
  //     if (Array.isArray(output) && output.length > 0) {
  //       caption = output[0]?.text || ''; // Adjust field name based on actual output
  //     }

  //     // If the output is an object with a caption-like field
  //     // if (output?.text) {
  //     //   caption = output.text; // If the text is directly in the output object
  //     // }

  //     console.log('Generated Caption:', caption);

  //     // Save image entry including caption
  //     const image_url = `/uploads/images/${file.filename}`;
  //     return this.productImageService.createProductImage({
  //       ...body,
  //       image_url,
  //       caption, // Pass the extracted caption here
  //     });
  //   } catch (error) {
  //     console.error('Error processing image:', error);
  //     throw new Error('Failed to process image with AI verification');
  //   }
  // }

  @Post('image')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/images',
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname);
          const fileName = `${uniqueSuffix}${ext}`;
          callback(null, fileName);
        },
      }),
    }),
  )
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { product_id: number; variant_id: number; is_main: boolean },
    @Request() req,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can upload product images');
    }

    const filePath = file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = `data:image/${extname(file.originalname).replace('.', '')};base64,${fileBuffer.toString('base64')}`;

    try {
      // First try to get caption
      let caption = '';
      try {
        const hfResponse = await axios.post(
          'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
          { inputs: base64 },
          {
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`, // Always use env variables
              'Content-Type': 'application/json',
            },
          },
        );

        if (hfResponse.data && Array.isArray(hfResponse.data)) {
          caption = hfResponse.data[0]?.generated_text || '';
        }
      } catch (hfError) {
        console.warn(
          'Hugging Face captioning failed:',
          hfError.response?.data || hfError.message,
        );
        // Fallback to empty caption if API fails
        caption = '';
      }

      // Save image even if caption fails
      const image_url = `/uploads/images/${file.filename}`;
      return this.productImageService.createProductImage({
        ...body,
        image_url, // Will be empty if API failed
      });
    } catch (error) {
      // Clean up the uploaded file if something went wrong
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.error('Image upload failed:', error);
      throw new HttpException(
        'Failed to upload product image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('image/:id')
  async findOneProductImage(@Param('id') id: number) {
    return await this.productImageService.findOneProductImage(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('image/:id')
  async updateProductImage(
    @Request() req,
    @Param('id') id: number,
    @Body() body: UpdateProductImageDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can update product images');
    }
    return await this.productImageService.updateProductImage(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('image/:id')
  async removeProductImage(@Request() req, @Param('id') id: number) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can delete product images');
    }
    return await this.productImageService.removeProductImage(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('variant/:id')
  async removeProductVariant(@Request() req, @Param('id') id: number) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can delete product images');
    }
    return await this.productVariantService.removeProductVariant(id);
  }
}
