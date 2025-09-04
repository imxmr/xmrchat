import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'coins' })
@Unique('name-and-ticker-and-network', ['name', 'ticker', 'network'])
export class Coin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  ticker: string;

  @Column()
  network: string;

  @Column()
  image: string;

  @Column({ type: 'numeric' })
  minimum: number;

  @Column({ type: 'numeric' })
  maximum: number;
}
