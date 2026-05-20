import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Poll } from './Poll';
import { User } from './User';

@Entity('poll_shares')
export class PollShare {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'poll_id', type: 'integer' })
  pollId: number;

  @ManyToOne(() => Poll, poll => poll.pollShares)
  poll: Poll;

  @Column({ name: 'share_code', type: 'varchar', length: 8, unique: true })
  shareCode: string;

  @Column({ name: 'created_by', type: 'integer' })
  createdById: number;

  @ManyToOne(() => User, user => user.pollShares)
  createdBy: User;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
