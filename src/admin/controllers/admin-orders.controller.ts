import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../users/enums/roles.enum';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('G. Admin - Orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all orders (admin view)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: OrderStatus,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    return this.ordersService.findAll(page, limit, status, startDate, endDate, userId);
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Get detailed revenue analytics' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiQuery({ name: 'interval', required: false, enum: ['day', 'week', 'month'] })
  getRevenueAnalytics(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('interval') interval: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.ordersService.getRevenueAnalytics(startDate, endDate, interval);
  }

  @Get('analytics/customer')
  @ApiOperation({ summary: 'Get customer order analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getCustomerAnalytics(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    return this.ordersService.getCustomerAnalytics(startDate, endDate);
  }

  @Get('analytics/product')
  @ApiOperation({ summary: 'Get product performance analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  getProductAnalytics(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    return this.ordersService.getProductAnalytics(startDate, endDate);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (admin only)' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Body('adminNotes') adminNotes?: string,
  ) {
    return this.ordersService.updateStatus(id, status, adminNotes);
  }

  @Patch('bulk-status')
  @ApiOperation({ summary: 'Update multiple orders status (admin only)' })
  @ApiResponse({ status: 200, description: 'Orders status updated successfully' })
  updateBulkStatus(
    @Body('orderIds') orderIds: string[],
    @Body('status') status: OrderStatus,
    @Body('adminNotes') adminNotes?: string,
  ) {
    return this.ordersService.updateBulkStatus(orderIds, status, adminNotes);
  }
} 