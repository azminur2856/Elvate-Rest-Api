import { Controller, Get, Post, Body, Patch, Param, Delete, ValidationPipe, UsePipes } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getInitMessage(){
    return 'Welcome to the Orders API!';
  }

  @Post('createOrder')
  // @UsePipes(new ValidationPipe())
  create(@Body() data: CreateOrderDto) {
    return this.ordersService.create(data);
  }

  @Get('findAllOrders')
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('findOrder/:id')
  findOne(@Param('id') id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch('updateOrder/:id')
  update(@Param('id') id: number, @Body() data: UpdateOrderDto) {
    return this.ordersService.update(id, data);
  }

  @Delete('deleteOrder/:id')
  remove(@Param('id') id: number) {
    return this.ordersService.remove(id);
  }
}
