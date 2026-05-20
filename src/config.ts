export const config = {
  jwtSecret: process.env.JWT_SECRET || 'pollwave-secret-key-2026',
  jwtExpiresIn: '24h',
  port: parseInt(process.env.PORT || '7911'),
};
