import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrderEntity } from "./order.entity";

@Entity({ name:'shipping'})
export class ShippingEntity{
    @PrimaryGeneratedColumn()
    id: number;

    @Column({default: ' '})
    name: string;

    @Column()
    phone: string;

    @Column()
    address: string;

    @Column()
    city: string;

    @Column()
    state: string;

    @Column()
    country: string;

    @Column()
    postCode: string;

    @OneToOne(() => OrderEntity, (order) => order.shippingAddress)
    order: OrderEntity;

}