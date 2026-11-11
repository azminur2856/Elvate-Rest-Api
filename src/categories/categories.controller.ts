import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Whole tree; roots are men, women, children. */
  @Public()
  @Get()
  tree() {
    return this.categories.tree();
  }

  /** One category with its children and a root → self breadcrumb. */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }

  @Roles(...SHOP_MANAGER_ROLES)
  @Post()
  create(@Body() dto: CreateCategoryDto, @Req() req: AuthRequest) {
    return this.categories.create(dto, req.user);
  }

  @Roles(...SHOP_MANAGER_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AuthRequest,
  ) {
    return this.categories.update(id, dto, req.user);
  }

  @Roles(...SHOP_MANAGER_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.categories.remove(id, req.user);
  }
}
