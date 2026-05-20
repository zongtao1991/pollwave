import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Response } from './Response';
import { Question } from './Question';

@Entity('answers')
export class Answer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'response_id', type: 'integer' })
  responseId: number;

  @ManyToOne(() => Response, response => response.answers)
  response: Response;

  @Column({ name: 'question_id', type: 'integer' })
  questionId: number;

  @ManyToOne(() => Question, question => question.answers)
  question: Question;

  @Column({ type: 'text' })
  value: string;
}
