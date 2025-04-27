import { OrderEntity } from "src/orders/entities/order.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Timestamp } from "typeorm";

@Entity({ name:'users'})
export class UserEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(() => OrderEntity, (order) => order.updatedBy)
    ordersUpdateBy: OrderEntity[];
}
