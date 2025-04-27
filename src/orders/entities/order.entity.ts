import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { OrderStatus } from "../enums/order-status.enum";
import { UserEntity } from "src/users/entities/user.entity";
import { ShippingEntity } from "./shipping.entity";

@Entity({ name:'orders'})
export class OrderEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    orderAt: Timestamp;

    @Column({type: 'enum', enum: OrderStatus, default: OrderStatus.PROCESSING})
    status: string;

    @Column({nullable: true})
    shippedAt: Date;

    @Column({nullable: true})
    deliveredAt: Date;

    @Column({nullable: true})
    returnedAt: Date;

    @ManyToOne(() => UserEntity, (user) => user.ordersUpdateBy)
    updatedBy: UserEntity;

    @OneToOne(() => ShippingEntity, (ship) => ship.order, { cascade: true })
    shippingAddress: ShippingEntity;

}
