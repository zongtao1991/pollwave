import { DataSource } from 'typeorm';
import { User, Poll, Question, Response, Answer, PollShare } from './entities';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pollwave.db');

export const AppDataSource = new DataSource({
  type: 'sqljs',
  location: dbPath,
  autoSave: true,
  entities: [User, Poll, Question, Response, Answer, PollShare],
  synchronize: true,
  logging: false,
});
