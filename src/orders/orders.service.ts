import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus } from './enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
import { Users } from '../users/entities/users.entity';
import { Address } from '../users/entities/address.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly productsService: ProductsService,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    // Check stock availability for all products first
    for (const item of createOrderDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new NotFoundException(
          `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`
        );
      }
    }

    // Create initial order
    const order = new Order();
    order.userId = userId;
    order.status = OrderStatus.PENDING;
    order.notes = createOrderDto.notes ?? null;
    order.paymentDetails = {
      method: createOrderDto.paymentMethod,
      status: 'PENDING',
      amount: 0,
      transactionId: ''
    };
    order.totalAmount = 0; // Initial amount, will be updated after calculating items

    const savedOrder = await this.orderRepository.save(order);

    let totalAmount = 0;
    const orderItems: OrderItem[] = [];

    for (const item of createOrderDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found`);
      }

      // Update stock quantity
      product.stockQuantity -= item.quantity;
      await this.productRepository.save(product);

      const orderItem = this.orderItemRepository.create({
        orderId: savedOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        total: product.price * item.quantity,
      });

      totalAmount += orderItem.total;
      orderItems.push(orderItem);
    }

    await this.orderItemRepository.save(orderItems);
    
    // Update order with final amount
    savedOrder.totalAmount = totalAmount;
    
    // Update payment details with final amount
    if (!savedOrder.paymentDetails) {
      savedOrder.paymentDetails = {
        method: createOrderDto.paymentMethod,
        status: 'PENDING',
        amount: totalAmount,
        transactionId: ''
      };
    } else {
      savedOrder.paymentDetails.amount = totalAmount;
    }
    
    return this.orderRepository.save(savedOrder);
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: OrderStatus,
    startDate?: Date,
    endDate?: Date,
    userId?: string,
  ) {
    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(endDate);
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      relations: ['items', 'items.product', 'user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'user'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findOne(id);

    if (updateOrderDto.status) {
      order.status = updateOrderDto.status;
    }

    if (updateOrderDto.notes) {
      order.notes = updateOrderDto.notes;
    }

    if (updateOrderDto.refundAmount) {
      order.refundAmount = updateOrderDto.refundAmount;
      order.status = OrderStatus.REFUNDED;
    }

    return this.orderRepository.save(order);
  }

  async updateStatus(id: string, status: OrderStatus, adminNotes?: string) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    order.status = status;
    if (adminNotes) {
      order.notes = order.notes 
        ? `${order.notes}\n[Admin Note]: ${adminNotes}`
        : `[Admin Note]: ${adminNotes}`;
    }

    return this.orderRepository.save(order);
  }

  async updateBulkStatus(orderIds: string[], status: OrderStatus, adminNotes?: string) {
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
    });

    if (orders.length !== orderIds.length) {
      throw new NotFoundException('Some orders not found');
    }

    const updatedOrders = orders.map(order => {
      order.status = status;
      if (adminNotes) {
        order.notes = order.notes 
          ? `${order.notes}\n[Admin Note]: ${adminNotes}`
          : `[Admin Note]: ${adminNotes}`;
      }
      return order;
    });

    return this.orderRepository.save(updatedOrders);
  }

  // Analytics methods
  async getOrderAnalytics(startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(endDate);
    }

    const orders = await this.orderRepository.find({
      where,
      relations: ['items'],
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Get popular products
    const orderItems = await this.orderItemRepository
      .createQueryBuilder('orderItem')
      .select('orderItem.productId, SUM(orderItem.quantity) as totalQuantity')
      .groupBy('orderItem.productId')
      .orderBy('totalQuantity', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      ordersByStatus,
      popularProducts: orderItems,
    };
  }

  async getSalesTrends(startDate: Date, endDate: Date, interval: 'day' | 'week' | 'month' = 'day') {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select(`DATE_TRUNC('${interval}', order.createdAt) as date`)
      .addSelect('COUNT(*) as orderCount')
      .addSelect('SUM(order.totalAmount) as totalRevenue')
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('date')
      .orderBy('date', 'ASC');

    return query.getRawMany();
  }

  async getRevenueAnalytics(startDate: Date, endDate: Date, interval: 'day' | 'week' | 'month' = 'day') {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select([
        `DATE_TRUNC('${interval}', order.createdAt) as period`,
        'SUM(order.totalAmount) as revenue',
        'COUNT(order.id) as orderCount',
        'AVG(order.totalAmount) as averageOrderValue'
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy('period')
      .orderBy('period', 'ASC');

    return query.getRawMany();
  }

  async getCustomerAnalytics(startDate?: Date, endDate?: Date) {
    const query = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'COUNT(order.id) as orderCount',
        'SUM(order.totalAmount) as totalSpent',
        'MAX(order.createdAt) as lastOrderDate'
      ])
      .leftJoin('user.orders', 'order')
      .groupBy('user.id')
      .orderBy('totalSpent', 'DESC');

    if (startDate && endDate) {
      query.where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    return query.getRawMany();
  }

  async getProductAnalytics(startDate?: Date, endDate?: Date) {
    const query = this.productRepository
      .createQueryBuilder('product')
      .select([
        'product.id',
        'product.name',
        'product.price',
        'product.stockQuantity',
        'COALESCE(SUM(orderItem.quantity), 0) as totalQuantity',
        'COALESCE(SUM(orderItem.total), 0) as totalRevenue',
        'COUNT(DISTINCT order.id) as orderCount'
      ])
      .leftJoin('product.orderItems', 'orderItem')
      .leftJoin('orderItem.order', 'order')
      .groupBy('product.id')
      .orderBy('totalRevenue', 'DESC');

    if (startDate && endDate) {
      query.where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const results = await query.getRawMany();

    return results.map(result => ({
      id: result.product_id,
      name: result.product_name,
      price: parseFloat(result.product_price),
      currentStock: result.product_stockQuantity,
      totalQuantitySold: parseInt(result.totalQuantity),
      totalRevenue: parseFloat(result.totalRevenue),
      orderCount: parseInt(result.orderCount),
      averageOrderValue: result.orderCount > 0 
        ? parseFloat(result.totalRevenue) / parseInt(result.orderCount)
        : 0
    }));
  }
} 