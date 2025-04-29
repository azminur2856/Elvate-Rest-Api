import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Put,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create_category.dto';
import { Category } from './entities/category.entity';
import { UpdateCategoryDto } from './dto/update_category.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createCategory(
    @Request() req,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can create categories');
    }
    return this.categoryService.createCategory(createCategoryDto);
  }

  @Get()
  async getCategories() {
    return this.categoryService.getCategories();
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: number) {
    return this.categoryService.getCategoryById(id);
  }

  @Put(':id')
  async updateCategory(
    @Param('id') id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Body('updatedBy') updatedBy: number,
  ) {
    return this.categoryService.updateCategory(
      id,
      updateCategoryDto,
      updatedBy,
    );
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: number) {
    return this.categoryService.deleteCategory(id);
  }
}
