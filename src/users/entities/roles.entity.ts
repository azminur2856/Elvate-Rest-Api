import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Role } from '../enums/roles.enum';

@Entity()
export class Roles {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: Role,
    unique: true,
  })
  name: Role;

  @ManyToMany(() => Users, (user) => user.roles)
  users: Users[];
}
