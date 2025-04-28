import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OrderStatus } from '../enums/order-status.enum';
import { ShippingEntity } from '../entities/shipping.entity';
import { UserEntity } from 'src/users/entities/user.entity';

export class CreateOrderDto {
    @IsOptional()
    @IsNumber()
    id?: number;

    @IsString()
    @IsNotEmpty()
    productName: string;

    @IsNumber()
    @Min(1)
    @IsNotEmpty()
    quantity: number;

    @IsNumber()
    price: number;

    @IsOptional()
    orderAt?: Date;

    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;

    @IsOptional()
    shippedAt?: Date;

    @IsOptional()
    deliveredAt?: Date;

    @IsOptional()
    returnedAt?: Date;

    @IsOptional()
    createdBy?: UserEntity;

    @IsOptional()
    updatedBy?: UserEntity;

    @IsOptional()
    shippingAddress?: ShippingEntity;
}

