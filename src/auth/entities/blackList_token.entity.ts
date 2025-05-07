import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('blacklist_tokens')
export class BlacklistToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  token: string;

  @Column('timestamp')
  expiresAt: Date;
}
