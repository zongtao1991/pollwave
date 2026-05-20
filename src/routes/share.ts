import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Poll, PollShare, Question, Response as ResponseEntity, Answer } from '../entities';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateUniqueShareCode } from '../utils/shareCode';

const router = Router();

const pollRepository = () => AppDataSource.getRepository(Poll);
const pollShareRepository = () => AppDataSource.getRepository(PollShare);
const questionRepository = () => AppDataSource.getRepository(Question);
const responseRepository = () => AppDataSource.getRepository(ResponseEntity);
const answerRepository = () => AppDataSource.getRepository(Answer);

let io: any = null;

export const setShareIoInstance = (ioInstance: any) => {
  io = ioInstance;
};

const getPollByShareCode = async (code: string): Promise<Poll | null> => {
  let poll = await pollRepository().findOne({
    where: { shareCode: code },
    relations: ['questions'],
  });

  if (!poll) {
    const pollShare = await pollShareRepository().findOne({
      where: { shareCode: code },
      relations: ['poll', 'poll.questions'],
    });
    if (pollShare) {
      if (pollShare.expiresAt && pollShare.expiresAt < new Date()) {
        return null;
      }
      poll = pollShare.poll;
    }
  }

  return poll;
};

router.post('/polls/:id/share', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);
    const { expiresIn } = req.body;

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    const shareCode = await generateUniqueShareCode();

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
      : null;

    const pollShare = pollShareRepository().create({
      pollId: poll.id,
      shareCode,
      createdById: req.userId!,
      expiresAt,
    });

    await pollShareRepository().save(pollShare);

    res.json({
      shareCode,
      shareUrl: `${req.protocol}://${req.get('host')}/share/${shareCode}`,
      expiresAt,
    });
  } catch (error) {
    console.error('生成分享链接错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/share/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    const poll = await getPollByShareCode(code);

    if (!poll) {
      return res.status(404).json({ error: '分享链接无效或已过期' });
    }

    if (poll.status === 'draft') {
      return res.status(400).json({ error: '投票尚未发布' });
    }

    if (poll.status === 'closed') {
      return res.status(400).json({ error: '投票已关闭' });
    }

    const questions = poll.questions
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        isRequired: q.isRequired,
        options: q.optionsArray,
      }));

    res.json({
      pollId: poll.id,
      title: poll.title,
      description: poll.description,
      isAnonymous: poll.isAnonymous,
      questions,
    });
  } catch (error) {
    console.error('获取分享投票错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/share/:code/respond', async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    const { answers, respondentName } = req.body;

    const poll = await getPollByShareCode(code);

    if (!poll) {
      return res.status(404).json({ error: '分享链接无效或已过期' });
    }

    if (poll.status !== 'active') {
      return res.status(400).json({ error: '投票已关闭或未发布' });
    }

    const ipAddress = (req.ip || req.headers['x-forwarded-for'] || '').toString();

    let respondentId: number | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { config } = require('../config');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: number };
        respondentId = decoded.userId;
      } catch (e) {
        respondentId = null;
      }
    }

    const questions = poll.questions.sort((a, b) => a.sortOrder - b.sortOrder);

    for (const question of questions) {
      if (question.isRequired) {
        const answer = answers?.find((a: any) => a.questionId === question.id);
        if (!answer || !answer.value || (typeof answer.value === 'string' && !answer.value.trim())) {
          return res.status(400).json({ error: `题目 "${question.text}" 为必填项` });
        }
      }
    }

    let newResponse: ResponseEntity | null = null;
    let pollReachedMax = false;

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      let queryBuilder = transactionalEntityManager
        .createQueryBuilder(ResponseEntity, 'response')
        .where('response.pollId = :pollId', { pollId: poll.id });

      if (poll.isAnonymous) {
        queryBuilder = queryBuilder.andWhere('response.ipAddress = :ipAddress', { ipAddress });
      } else {
        if (respondentId) {
          queryBuilder = queryBuilder.andWhere('response.respondentId = :respondentId', { respondentId });
        } else {
          queryBuilder = queryBuilder.andWhere('response.ipAddress = :ipAddress', { ipAddress });
        }
      }

      const existingResponse = await queryBuilder
        .setLock('pessimistic_read')
        .getOne();

      if (existingResponse) {
        throw new Error('您已提交过此投票');
      }

      if (poll.maxResponses) {
        const currentResponses = await transactionalEntityManager
          .createQueryBuilder(ResponseEntity, 'response')
          .where('response.pollId = :pollId', { pollId: poll.id })
          .setLock('pessimistic_read')
          .getCount();

        if (currentResponses >= poll.maxResponses) {
          const pollToUpdate = await transactionalEntityManager.findOne(Poll, {
            where: { id: poll.id },
          });
          if (pollToUpdate && pollToUpdate.status === 'active') {
            pollToUpdate.status = 'closed';
            await transactionalEntityManager.save(pollToUpdate);
            pollReachedMax = true;
          }
          throw new Error('投票已达到最大响应数');
        }
      }

      const response = responseRepository().create({
        pollId: poll.id,
        respondentId: poll.isAnonymous ? null : respondentId,
        respondentName: poll.isAnonymous ? null : (respondentName || null),
        ipAddress,
      });

      await transactionalEntityManager.save(response);

      for (const answerData of answers || []) {
        const question = questions.find(q => q.id === answerData.questionId);
        if (!question) continue;

        let value = answerData.value;
        if (question.type === 'multiple_choice' && Array.isArray(value)) {
          value = JSON.stringify(value);
        } else if (question.type === 'rating') {
          value = String(value);
        }

        const answer = answerRepository().create({
          responseId: response.id,
          questionId: answerData.questionId,
          value,
        });

        await transactionalEntityManager.save(answer);
      }

      newResponse = response;

      if (poll.maxResponses) {
        const currentResponses = await transactionalEntityManager
          .createQueryBuilder(ResponseEntity, 'response')
          .where('response.pollId = :pollId', { pollId: poll.id })
          .setLock('pessimistic_read')
          .getCount();

        if (currentResponses >= poll.maxResponses) {
          const pollToUpdate = await transactionalEntityManager.findOne(Poll, {
            where: { id: poll.id },
          });
          if (pollToUpdate && pollToUpdate.status === 'active') {
            pollToUpdate.status = 'closed';
            await transactionalEntityManager.save(pollToUpdate);
            pollReachedMax = true;
          }
        }
      }
    });

    if (pollReachedMax && io) {
      io.to(`poll_${poll.id}`).emit('poll_status_changed', {
        pollId: poll.id,
        status: 'closed',
      });
    }

    if (io && newResponse) {
      const savedResponse = await responseRepository().findOne({
        where: { id: newResponse.id },
        relations: ['answers'],
      });

      if (savedResponse) {
        io.to(`poll_${poll.id}`).emit('new_response', {
          responseId: savedResponse.id,
          submittedAt: savedResponse.submittedAt,
          answers: savedResponse.answers.map(a => ({
            questionId: a.questionId,
            value: a.value,
          })),
        });
      }
    }

    res.json({
      message: '提交成功',
      responseId: newResponse?.id,
    });
  } catch (error: any) {
    console.error('提交回答错误:', error);
    
    if (error.message === '您已提交过此投票' || error.message === '投票已达到最大响应数') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message || '服务器错误' });
  }
});

export const shareRoutes = router;
