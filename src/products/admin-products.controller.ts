import { ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminProductsService, MAX_IMAGES } from './admin-products.service';
import {
  AdminProductQueryDto,
  CreateProductDto,
  UpdateImageDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantInputDto,
} from './dto/admin-product.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';
import { MB, UPLOAD_LIMITS } from 'src/common/upload';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Admin product management (BE-12): ADMIN and STAFF. */
@ApiTags('Admin · Products')
@Roles(...SHOP_MANAGER_ROLES)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly admin: AdminProductsService) {}

  @Get()
  list(@Query() query: AdminProductQueryDto) {
    return this.admin.list(query);
  }

  // ----- variants (declared before ':id' routes) -----

  @Patch('variants/:variantId')
  updateVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.updateVariant(variantId, dto, req.user);
  }

  @Delete('variants/:variantId')
  removeVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Req() req: AuthRequest,
  ) {
    return this.admin.removeVariant(variantId, req.user);
  }

  // ----- products -----

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.detail(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: AuthRequest) {
    return this.admin.create(dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.admin.remove(id, req.user);
  }

  @Post(':id/variants')
  addVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VariantInputDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.addVariant(id, dto, req.user);
  }

  // ----- images (multipart field name: "files", repeated) -----

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMAGES, {
      storage: memoryStorage(),
      limits: {
        ...UPLOAD_LIMITS,
        fileSize: 5 * MB,
        files: MAX_IMAGES,
        parts: MAX_IMAGES + UPLOAD_LIMITS.fields,
      },
      fileFilter: (_req, file, cb) =>
        IMAGE_TYPES.includes(file.mimetype)
          ? cb(null, true)
          : cb(
              new BadRequestException(
                `${file.originalname}: only JPG, PNG or WebP images are allowed`,
              ),
              false,
            ),
    }),
  )
  addImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthRequest,
  ) {
    return this.admin.addImages(id, files, req.user);
  }

  @Patch(':id/images/:imageId')
  updateImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateImageDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.updateImage(id, imageId, dto, req.user);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() req: AuthRequest,
  ) {
    return this.admin.removeImage(id, imageId, req.user);
  }
}
