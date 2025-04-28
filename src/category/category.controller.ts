import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create_category.dto';
import { Category } from './entities/category.entity';
import { UpdateCategoryDto } from './dto/update_category.dto';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Create a category
  @Post()
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.createCategory(createCategoryDto);
  }

  // Get all categories
  @Get()
  async getCategories() {
    return this.categoryService.getCategories();
  }

  // Get category by ID
  @Get(':id')
  async getCategoryById(@Param('id') id: number) {
    return this.categoryService.getCategoryById(id);
  }

  // Update a category
  @Put(':id')
  async updateCategory(
    @Param('id') id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Body('updatedBy') updatedBy: number, // Assuming you pass the user ID here
  ) {
    return this.categoryService.updateCategory(
      id,
      updateCategoryDto,
      updatedBy,
    );
  }

  // Delete a category
  @Delete(':id')
  async deleteCategory(@Param('id') id: number) {
    return this.categoryService.deleteCategory(id);
  }
}
