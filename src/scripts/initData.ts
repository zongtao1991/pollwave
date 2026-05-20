import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { User, Poll, Question, Response, Answer, PollShare } from '../entities';
import bcrypt from 'bcryptjs';
import { generateUniqueShareCode } from '../utils/shareCode';

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const createUsers = async () => {
  const userRepo = AppDataSource.getRepository(User);

  const adminPassword = await hashPassword('admin123');
  const admin = userRepo.create({
    username: 'admin',
    email: 'admin@test.com',
    passwordHash: adminPassword,
  });
  await userRepo.save(admin);

  const demoPassword = await hashPassword('demo123');
  const demo = userRepo.create({
    username: 'demo',
    email: 'demo@test.com',
    passwordHash: demoPassword,
  });
  await userRepo.save(demo);

  console.log('用户创建完成: admin / demo');
  return { admin, demo };
};

const createTechStackPoll = async (admin: User) => {
  const pollRepo = AppDataSource.getRepository(Poll);
  const questionRepo = AppDataSource.getRepository(Question);
  const pollShareRepo = AppDataSource.getRepository(PollShare);

  const shareCode = await generateUniqueShareCode();

  const poll = pollRepo.create({
    creatorId: admin.id,
    creator: admin,
    title: '2026 团队技术栈偏好调查',
    description: '了解团队对未来技术栈的偏好，帮助做出更合理的技术选型决策。',
    isAnonymous: true,
    allowMultiple: false,
    status: 'active',
    shareCode,
    maxResponses: 100,
    closedAt: null,
  });
  await pollRepo.save(poll);

  const questions: Question[] = [];

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你更倾向于使用哪种后端框架？',
    type: 'single_choice',
    isRequired: true,
    sortOrder: 0,
    options: JSON.stringify(['Node.js + Express', 'Python + Django/Flask', 'Go', 'Java + Spring Boot', 'Rust']),
  }));

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你希望团队引入哪些前端技术？（可多选）',
    type: 'multiple_choice',
    isRequired: true,
    sortOrder: 1,
    options: JSON.stringify(['React', 'Vue.js', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Vite']),
  }));

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你对当前开发环境的满意度是？',
    type: 'rating',
    isRequired: true,
    sortOrder: 2,
    options: null,
  }));

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你认为我们最需要改进的开发工具或流程是什么？',
    type: 'text_input',
    isRequired: false,
    sortOrder: 3,
    options: null,
  }));

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你更愿意学习哪种新的编程语言？',
    type: 'single_choice',
    isRequired: false,
    sortOrder: 4,
    options: JSON.stringify(['Rust', 'Go', 'Kotlin', 'Swift', '其他']),
  }));

  for (const q of questions) {
    await questionRepo.save(q);
  }

  const pollShare = pollShareRepo.create({
    pollId: poll.id,
    poll: poll,
    shareCode: await generateUniqueShareCode(),
    createdById: admin.id,
    createdBy: admin,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await pollShareRepo.save(pollShare);

  console.log('投票创建完成: 2026 团队技术栈偏好调查');
  return { poll, questions };
};

const createProductPriorityPoll = async (demo: User) => {
  const pollRepo = AppDataSource.getRepository(Poll);
  const questionRepo = AppDataSource.getRepository(Question);
  const pollShareRepo = AppDataSource.getRepository(PollShare);

  const shareCode = await generateUniqueShareCode();

  const poll = pollRepo.create({
    creatorId: demo.id,
    creator: demo,
    title: '产品需求优先级投票',
    description: '请为下个季度的产品需求进行优先级排序投票。',
    isAnonymous: false,
    allowMultiple: false,
    status: 'draft',
    shareCode,
    maxResponses: 50,
    closedAt: null,
  });
  await pollRepo.save(poll);

  const questions: Question[] = [];

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你认为最重要的功能是？',
    type: 'single_choice',
    isRequired: true,
    sortOrder: 0,
    options: JSON.stringify(['黑暗模式支持', '数据分析面板', 'API 接口增强', '移动端适配优化', '用户反馈系统']),
  }));

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '你对当前产品的整体满意度？',
    type: 'rating',
    isRequired: true,
    sortOrder: 1,
    options: null,
  }));

  questions.push(questionRepo.create({
    pollId: poll.id,
    poll: poll,
    text: '有其他建议或想法吗？',
    type: 'text_input',
    isRequired: false,
    sortOrder: 2,
    options: null,
  }));

  for (const q of questions) {
    await questionRepo.save(q);
  }

  const pollShare = pollShareRepo.create({
    pollId: poll.id,
    poll: poll,
    shareCode: await generateUniqueShareCode(),
    createdById: demo.id,
    createdBy: demo,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  await pollShareRepo.save(pollShare);

  console.log('投票创建完成: 产品需求优先级投票');
  return { poll, questions };
};

const createMockResponses = async (poll: Poll, questions: Question[]) => {
  const responseRepo = AppDataSource.getRepository(Response);
  const answerRepo = AppDataSource.getRepository(Answer);

  const mockRespondents = [
    { name: '张三', ip: '192.168.1.101' },
    { name: '李四', ip: '192.168.1.102' },
    { name: '王五', ip: '192.168.1.103' },
    { name: '赵六', ip: '192.168.1.104' },
    { name: '钱七', ip: '192.168.1.105' },
    { name: '孙八', ip: '192.168.1.106' },
    { name: '周九', ip: '192.168.1.107' },
    { name: '吴十', ip: '192.168.1.108' },
  ];

  const q1 = questions[0];
  const q2 = questions[1];
  const q3 = questions[2];
  const q4 = questions[3];
  const q5 = questions[4];

  const mockAnswers = [
    {
      q1: 'Node.js + Express',
      q2: ['React', 'TypeScript', 'Vite'],
      q3: 4,
      q4: '希望能有更好的代码审查工具集成',
      q5: 'Rust',
    },
    {
      q1: 'Go',
      q2: ['Vue.js', 'Tailwind CSS'],
      q3: 5,
      q4: '',
      q5: 'Go',
    },
    {
      q1: 'Python + Django/Flask',
      q2: ['React', 'Next.js', 'TypeScript'],
      q3: 3,
      q4: 'CI/CD 流程可以再优化一下',
      q5: 'Kotlin',
    },
    {
      q1: 'Node.js + Express',
      q2: ['TypeScript', 'Vite', 'Tailwind CSS'],
      q3: 4,
      q4: '',
      q5: 'Rust',
    },
    {
      q1: 'Java + Spring Boot',
      q2: ['Vue.js'],
      q3: 2,
      q4: '文档不够完善，新人上手困难',
      q5: 'Swift',
    },
    {
      q1: 'Go',
      q2: ['React', 'TypeScript', 'Next.js'],
      q3: 5,
      q4: '',
      q5: 'Go',
    },
    {
      q1: 'Node.js + Express',
      q2: ['React', 'Tailwind CSS', 'Vite'],
      q3: 4,
      q4: '测试覆盖率需要提高',
      q5: 'Rust',
    },
    {
      q1: 'Rust',
      q2: ['TypeScript', 'Next.js'],
      q3: 5,
      q4: '',
      q5: 'Rust',
    },
  ];

  for (let i = 0; i < mockRespondents.length; i++) {
    const respondent = mockRespondents[i];
    const answers = mockAnswers[i];

    const response = responseRepo.create({
      pollId: poll.id,
      poll: poll,
      respondentId: null,
      respondentName: poll.isAnonymous ? null : respondent.name,
      ipAddress: respondent.ip,
    });
    await responseRepo.save(response);

    const answerEntities: Answer[] = [];

    answerEntities.push(answerRepo.create({
      responseId: response.id,
      response: response,
      questionId: q1.id,
      question: q1,
      value: answers.q1,
    }));

    answerEntities.push(answerRepo.create({
      responseId: response.id,
      response: response,
      questionId: q2.id,
      question: q2,
      value: JSON.stringify(answers.q2),
    }));

    answerEntities.push(answerRepo.create({
      responseId: response.id,
      response: response,
      questionId: q3.id,
      question: q3,
      value: String(answers.q3),
    }));

    if (answers.q4) {
      answerEntities.push(answerRepo.create({
        responseId: response.id,
        response: response,
        questionId: q4.id,
        question: q4,
        value: answers.q4,
      }));
    }

    if (answers.q5) {
      answerEntities.push(answerRepo.create({
        responseId: response.id,
        response: response,
        questionId: q5.id,
        question: q5,
        value: answers.q5,
      }));
    }

    for (const a of answerEntities) {
      await answerRepo.save(a);
    }
  }

  console.log('模拟响应创建完成: 8 条响应');
};

const initData = async () => {
  try {
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    const { admin, demo } = await createUsers();
    const techStackResult = await createTechStackPoll(admin);
    await createProductPriorityPoll(demo);
    await createMockResponses(techStackResult.poll, techStackResult.questions);

    console.log('\n=== 测试数据初始化完成 ===');
    console.log('用户账号:');
    console.log('  - admin / admin@test.com / admin123');
    console.log('  - demo / demo@test.com / demo123');
    console.log('投票:');
    console.log('  - 2026 团队技术栈偏好调查 (active, 8 条响应)');
    console.log('  - 产品需求优先级投票 (draft)');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
};

initData();
