import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { AppDataSource } from './data-source';
import { config } from './config';
import { setupSocketIO } from './socket';
import { authRoutes } from './routes/auth';
import { pollRoutes } from './routes/polls';
import { shareRoutes } from './routes/share';

const app = express();
const httpServer = createServer(app);

const baseDir = process.cwd();
const publicDir = path.join(baseDir, 'public');
const nodeModulesDir = path.join(baseDir, 'node_modules');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(publicDir));

const socketIoClientPath = path.join(nodeModulesDir, 'socket.io/client-dist');
app.use('/libs/socket.io', express.static(socketIoClientPath));

const chartJsPath = path.join(nodeModulesDir, 'chart.js/dist');
app.use('/libs/chart.js', express.static(chartJsPath));

app.use('/api/auth', authRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api', shareRoutes);

app.get('/share/:code', (req, res) => {
  res.sendFile(path.join(publicDir, 'respond.html'));
});

app.get('/polls/:id/results', (req, res) => {
  res.sendFile(path.join(publicDir, 'results.html'));
});

app.get('/polls/:id/edit', (req, res) => {
  res.sendFile(path.join(publicDir, 'create-poll.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

setupSocketIO(httpServer);

AppDataSource.initialize()
  .then(() => {
    console.log('数据库连接成功');
    httpServer.listen(config.port, () => {
      console.log(`PollWave 服务器运行在 http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    console.error('数据库连接失败:', error);
  });
