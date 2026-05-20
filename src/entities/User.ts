import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Poll } from './Poll';
import { Response } from './Response';
import { PollShare } from './PollShare';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Poll, poll => poll.creator)
  polls: Poll[];

  @OneToMany(() => Response, response => response.respondent)
  responses: Response[];

  @OneToMany(() => PollShare, pollShare => pollShare.createdBy)
  pollShares: PollShare[];
}
