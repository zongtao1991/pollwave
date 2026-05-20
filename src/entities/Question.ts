import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Poll } from './Poll';
import { Answer } from './Answer';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'poll_id', type: 'integer' })
  pollId: number;

  @ManyToOne(() => Poll, poll => poll.questions)
  poll: Poll;

  @Column({ type: 'varchar', length: 500 })
  text: string;

  @Column({ type: 'varchar', length: 15 })
  type: 'single_choice' | 'multiple_choice' | 'text_input' | 'rating';

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder: number;

  @Column({ type: 'text', nullable: true })
  options: string;

  @OneToMany(() => Answer, answer => answer.question)
  answers: Answer[];

  get optionsArray(): string[] {
    return this.options ? JSON.parse(this.options) : [];
  }
}
