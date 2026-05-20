import { AppDataSource } from '../data-source';
import { Poll, PollShare } from '../entities';

export const generateShareCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateUniqueShareCode = async (): Promise<string> => {
  const pollRepository = AppDataSource.getRepository(Poll);
  const pollShareRepository = AppDataSource.getRepository(PollShare);
  
  let code: string;
  let isUnique: boolean;
  
  do {
    code = generateShareCode();
    const existingPoll = await pollRepository.findOne({ where: { shareCode: code } });
    const existingShare = await pollShareRepository.findOne({ where: { shareCode: code } });
    isUnique = !existingPoll && !existingShare;
  } while (!isUnique);
  
  return code;
};
