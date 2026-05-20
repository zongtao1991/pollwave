import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Poll } from './Poll';
import { User } from './User';
import { Answer } from './Answer';

@Entity('responses')
export class Response {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'poll_id', type: 'integer' })
  pollId: number;

  @ManyToOne(() => Poll, poll => poll.responses)
  poll: Poll;

  @Column({ name: 'respondent_id', type: 'integer', nullable: true })
  respondentId: number | null;

  @ManyToOne(() => User, user => user.responses, { nullable: true })
  respondent: User | null;

  @Column({ name: 'respondent_name', type: 'varchar', length: 50, nullable: true })
  respondentName: string | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @OneToMany(() => Answer, answer => answer.response)
  answers: Answer[];
}
