import { Router, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Poll, Question, Response as ResponseEntity, Answer, User } from '../entities';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateUniqueShareCode } from '../utils/shareCode';

const router = Router();
router.use(authMiddleware);

const pollRepository = () => AppDataSource.getRepository(Poll);
const questionRepository = () => AppDataSource.getRepository(Question);
const responseRepository = () => AppDataSource.getRepository(ResponseEntity);
const answerRepository = () => AppDataSource.getRepository(Answer);
const userRepository = () => AppDataSource.getRepository(User);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const polls = await pollRepository().find({
      where: { creatorId: req.userId },
      order: { createdAt: 'DESC' },
      relations: ['questions'],
    });

    const pollsWithResponseCount = await Promise.all(
      polls.map(async (poll) => {
        const responseCount = await responseRepository().count({
          where: { pollId: poll.id },
        });
        return { ...poll, responseCount };
      })
    );

    res.json(pollsWithResponseCount);
  } catch (error) {
    console.error('获取投票列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, isAnonymous, allowMultiple, questions } = req.body;

    if (!title) {
      return res.status(400).json({ error: '投票标题不能为空' });
    }

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: '投票至少需要一道题目' });
    }

    const shareCode = await generateUniqueShareCode();

    const poll = pollRepository().create({
      creatorId: req.userId!,
      title,
      description: description || '',
      isAnonymous: isAnonymous || false,
      allowMultiple: allowMultiple || false,
      status: 'draft',
      shareCode,
    });

    await pollRepository().save(poll);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const question = questionRepository().create({
        pollId: poll.id,
        text: q.text,
        type: q.type,
        isRequired: q.isRequired !== false,
        sortOrder: i,
        options: q.options ? JSON.stringify(q.options) : null,
      });
      await questionRepository().save(question);
    }

    const createdPoll = await pollRepository().findOne({
      where: { id: poll.id },
      relations: ['questions'],
    });

    res.status(201).json(createdPoll);
  } catch (error) {
    console.error('创建投票错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
      relations: ['questions'],
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    res.json(poll);
  } catch (error) {
    console.error('获取投票详情错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);
    const { title, description, isAnonymous, allowMultiple, questions } = req.body;

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    if (poll.status !== 'draft') {
      return res.status(400).json({ error: '只能修改草稿状态的投票' });
    }

    if (title) poll.title = title;
    if (description !== undefined) poll.description = description;
    if (isAnonymous !== undefined) poll.isAnonymous = isAnonymous;
    if (allowMultiple !== undefined) poll.allowMultiple = allowMultiple;

    await pollRepository().save(poll);

    if (questions) {
      await questionRepository().delete({ pollId: poll.id });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const question = questionRepository().create({
          pollId: poll.id,
          text: q.text,
          type: q.type,
          isRequired: q.isRequired !== false,
          sortOrder: i,
          options: q.options ? JSON.stringify(q.options) : null,
        });
        await questionRepository().save(question);
      }
    }

    const updatedPoll = await pollRepository().findOne({
      where: { id: poll.id },
      relations: ['questions'],
    });

    res.json(updatedPoll);
  } catch (error) {
    console.error('修改投票错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    const answers = await answerRepository()
      .createQueryBuilder('answer')
      .innerJoin('answer.response', 'response')
      .where('response.pollId = :pollId', { pollId })
      .getMany();
    
    if (answers.length > 0) {
      await answerRepository().remove(answers);
    }

    await responseRepository().delete({ pollId });
    await questionRepository().delete({ pollId });
    await pollRepository().delete({ id: pollId });

    res.json({ message: '投票已删除' });
  } catch (error) {
    console.error('删除投票错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/activate', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
      relations: ['questions'],
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    if (!poll.questions || poll.questions.length === 0) {
      return res.status(400).json({ error: '投票至少需要一道题目才能发布' });
    }

    poll.status = 'active';
    await pollRepository().save(poll);

    res.json(poll);
  } catch (error) {
    console.error('发布投票错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/close', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    poll.status = 'closed';
    await pollRepository().save(poll);

    res.json(poll);
  } catch (error) {
    console.error('关闭投票错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id/results', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
      relations: ['questions'],
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    const questions = poll.questions.sort((a, b) => a.sortOrder - b.sortOrder);
    const responses = await responseRepository().find({
      where: { pollId },
      relations: ['answers'],
    });

    const totalResponses = responses.length;

    const results = questions.map((question) => {
      const answeredResponseIds = new Set<number>();
      const questionAnswers = responses.flatMap(r => {
        const answers = r.answers.filter(a => a.questionId === question.id);
        if (answers.length > 0) {
          answeredResponseIds.add(r.id);
        }
        return answers;
      });

      const actualRespondentCount = answeredResponseIds.size;

      if (question.type === 'single_choice' || question.type === 'multiple_choice') {
        const options = question.optionsArray;
        const counts: Record<string, number> = {};
        options.forEach(opt => counts[opt] = 0);

        questionAnswers.forEach(answer => {
          if (question.type === 'multiple_choice') {
            const selectedOptions = JSON.parse(answer.value);
            selectedOptions.forEach((opt: string) => {
              if (counts[opt] !== undefined) counts[opt]++;
            });
          } else {
            if (counts[answer.value] !== undefined) {
              counts[answer.value]++;
            }
          }
        });

        return {
          questionId: question.id,
          questionText: question.text,
          type: question.type,
          options: options.map(opt => ({
            text: opt,
            count: counts[opt] || 0,
            percentage: actualRespondentCount > 0 ? Math.round((counts[opt] / actualRespondentCount) * 100) : 0,
          })),
          totalResponses: actualRespondentCount,
        };
      } else if (question.type === 'rating') {
        const ratings = questionAnswers.map(a => parseInt(a.value));
        const sum = ratings.reduce((a, b) => a + b, 0);
        const avg = ratings.length > 0 ? (sum / ratings.length).toFixed(1) : '0';

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(r => {
          if (distribution[r] !== undefined) distribution[r]++;
        });

        return {
          questionId: question.id,
          questionText: question.text,
          type: question.type,
          average: parseFloat(avg),
          totalRatings: ratings.length,
          distribution: Object.entries(distribution).map(([rating, count]) => ({
            rating: parseInt(rating),
            count,
          })),
          totalResponses: actualRespondentCount,
        };
      } else if (question.type === 'text_input') {
        return {
          questionId: question.id,
          questionText: question.text,
          type: question.type,
          responses: questionAnswers.map(a => a.value).filter(v => v && v.trim()),
          totalResponses: actualRespondentCount,
        };
      }

      return { 
        questionId: question.id, 
        questionText: question.text, 
        type: question.type,
        totalResponses: actualRespondentCount,
      };
    });

    res.json({
      pollId,
      totalResponses,
      results,
    });
  } catch (error) {
    console.error('获取投票结果错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id/responses', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    const responses = await responseRepository().find({
      where: { pollId },
      relations: ['answers', 'respondent'],
      order: { submittedAt: 'DESC' },
    });

    const formattedResponses = responses.map(response => ({
      id: response.id,
      submittedAt: response.submittedAt,
      respondentName: poll.isAnonymous ? '匿名' : (response.respondent?.username || response.respondentName || '匿名'),
      answers: response.answers.map(a => ({
        questionId: a.questionId,
        value: a.value,
      })),
    }));

    res.json(formattedResponses);
  } catch (error) {
    console.error('获取响应详情错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const pollId = parseInt(req.params.id);

    const poll = await pollRepository().findOne({
      where: { id: pollId, creatorId: req.userId },
      relations: ['questions'],
    });

    if (!poll) {
      return res.status(404).json({ error: '投票不存在' });
    }

    const escapeCsvCell = (value: string): string => {
      if (!value) return '';
      const str = String(value);
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || 
          str.startsWith('\t') || str.startsWith('\r')) {
        return "'" + str;
      }
      return str;
    };

    const questions = poll.questions.sort((a, b) => a.sortOrder - b.sortOrder);
    const responses = await responseRepository().find({
      where: { pollId },
      relations: ['answers', 'respondent'],
      order: { submittedAt: 'ASC' },
    });

    const headers = ['提交时间', '回答者'];
    questions.forEach(q => headers.push(q.text));

    const rows = responses.map(response => {
      const row: string[] = [
        response.submittedAt.toISOString(),
        poll.isAnonymous ? '匿名' : (response.respondent?.username || response.respondentName || '匿名'),
      ];

      questions.forEach(q => {
        const answer = response.answers.find(a => a.questionId === q.id);
        if (answer) {
          if (q.type === 'multiple_choice') {
            try {
              const opts = JSON.parse(answer.value);
              row.push(escapeCsvCell(opts.join(', ')));
            } catch {
              row.push(escapeCsvCell(answer.value));
            }
          } else {
            row.push(escapeCsvCell(answer.value));
          }
        } else {
          row.push('');
        }
      });

      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(poll.title)}.csv"`);
    res.send('\ufeff' + csvContent);
  } catch (error) {
    console.error('导出 CSV 错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

export const pollRoutes = router;
