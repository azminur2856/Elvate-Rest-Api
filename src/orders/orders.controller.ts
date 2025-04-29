import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/roles.enum';
import { Users } from '../users/entities/users.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrderStatus } from './enums/order-status.enum';

@ApiTags('D. Public - Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new order',
    description: 'Creates a new order with the specified items and payment details.'
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Order created successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PENDING',
        totalAmount: 99.99,
        items: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 2,
            price: 49.99,
            total: 99.98
          }
        ],
        createdAt: '2024-04-29T09:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid input data',
        error: 'Bad Request'
      }
    }
  })
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: User) {
    return this.ordersService.create(createOrderDto, user.id);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get current user orders',
    description: 'Retrieves a paginated list of orders for the current user with optional filtering.'
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number,
    description: 'Page number for pagination (default: 1)'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Number of items per page (default: 10)'
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: OrderStatus,
    description: 'Filter orders by status'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: Date,
    description: 'Filter orders created after this date'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: Date,
    description: 'Filter orders created before this date'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of orders retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'PENDING',
            totalAmount: 99.99,
            items: [
              {
                productId: '123e4567-e89b-12d3-a456-426614174000',
                quantity: 2,
                price: 49.99,
                total: 99.98
              }
            ],
            createdAt: '2024-04-29T09:00:00.000Z'
          }
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10
        }
      }
    }
  })
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: OrderStatus,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    return this.ordersService.findAll(page, limit, status, startDate, endDate, user.id);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get order by ID',
    description: 'Retrieves detailed information about a specific order. Users can only access their own orders.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Order found successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PENDING',
        totalAmount: 99.99,
        items: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 2,
            price: 49.99,
            total: 99.98
          }
        ],
        createdAt: '2024-04-29T09:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Order not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Order not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Cannot access another user\'s order',
    schema: {
      example: {
        statusCode: 403,
        message: 'You do not have permission to access this order',
        error: 'Forbidden'
      }
    }
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.ordersService.findOne(id);
    if (order.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to access this order');
    }
    return order;
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update order',
    description: 'Updates the status or notes of an existing order. Users can only update their own orders.'
  })
  @ApiBody({ type: UpdateOrderDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Order updated successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PROCESSING',
        notes: 'Order is being processed',
        updatedAt: '2024-04-29T09:30:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Order not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Order not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Cannot update another user\'s order',
    schema: {
      example: {
        statusCode: 403,
        message: 'You do not have permission to update this order',
        error: 'Forbidden'
      }
    }
  })
  async update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto, @CurrentUser() user: User) {
    const order = await this.ordersService.findOne(id);
    if (order.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to update this order');
    }
    return this.ordersService.update(id, updateOrderDto);
  }

  @Get('analytics/summary')
  @ApiOperation({ 
    summary: 'Get order analytics summary',
    description: 'Retrieves summary statistics about orders.'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: Date,
    description: 'Start date for analytics period'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: Date,
    description: 'End date for analytics period'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics summary retrieved successfully',
    schema: {
      example: {
        totalOrders: 100,
        totalRevenue: 9999.99,
        averageOrderValue: 99.99,
        ordersByStatus: {
          PENDING: 20,
          PROCESSING: 30,
          SHIPPED: 25,
          DELIVERED: 15,
          CANCELLED: 5,
          REFUNDED: 5
        }
      }
    }
  })
  getAnalytics(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    return this.ordersService.getOrderAnalytics(startDate, endDate);
  }

  @Get('analytics/trends')
  @ApiOperation({ 
    summary: 'Get sales trends',
    description: 'Retrieves sales trends over a specified time period.'
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: true, 
    type: Date,
    description: 'Start date for trend analysis'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: true, 
    type: Date,
    description: 'End date for trend analysis'
  })
  @ApiQuery({ 
    name: 'interval', 
    required: false, 
    enum: ['day', 'week', 'month'],
    description: 'Time interval for trend data (default: day)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Sales trends retrieved successfully',
    schema: {
      example: {
        trends: [
          {
            period: '2024-04-01',
            revenue: 999.99,
            orderCount: 10,
            averageOrderValue: 99.99
          },
          {
            period: '2024-04-02',
            revenue: 1499.99,
            orderCount: 15,
            averageOrderValue: 99.99
          }
        ]
      }
    }
  })
  getSalesTrends(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('interval') interval: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.ordersService.getSalesTrends(startDate, endDate, interval);
  }
} 