import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { OrderStatus } from "../enums/order-status.enum";
import { UserEntity } from "src/users/entities/user.entity";
import { ShippingEntity } from "./shipping.entity";

@Entity({ name:'orders'})
export class OrderEntity {
    @PrimaryColumn()
    id: number;

    @Column()
    productName: string;

    @Column()
    quantity: number;

    @Column('decimal')
    price: number;

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

    @CreateDateColumn()
    createdAt: Date;

    @CreateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => UserEntity, (user) => user.ordersCreatedBy)
    createdBy: UserEntity;

    @ManyToOne(() => UserEntity, (user) => user.ordersUpdatedBy)
    updatedBy: UserEntity;

    @OneToOne(() => ShippingEntity, (ship) => ship.order, { cascade: true, onDelete: 'CASCADE' })
    @JoinColumn()
    shippingAddress: ShippingEntity;

}

