import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from './User';
import { Question } from './Question';
import { Response } from './Response';
import { PollShare } from './PollShare';

@Entity('polls')
export class Poll {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'creator_id', type: 'integer' })
  creatorId: number;

  @ManyToOne(() => User, user => user.polls)
  creator: User;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_anonymous', type: 'boolean', default: false })
  isAnonymous: boolean;

  @Column({ name: 'allow_multiple', type: 'boolean', default: false })
  allowMultiple: boolean;

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status: 'draft' | 'active' | 'closed';

  @Column({ name: 'share_code', type: 'varchar', length: 8, unique: true, nullable: true })
  shareCode: string;

  @Column({ name: 'max_responses', type: 'integer', nullable: true })
  maxResponses: number | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Question, question => question.poll)
  questions: Question[];

  @OneToMany(() => Response, response => response.poll)
  responses: Response[];

  @OneToMany(() => PollShare, pollShare => pollShare.poll)
  pollShares: PollShare[];
}
