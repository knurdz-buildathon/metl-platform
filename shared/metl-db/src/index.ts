import { PrismaClient } from '@prisma/client';
import { logger } from '@metl/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug({ query: e.query, duration: e.duration }, 'Prisma query');
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
