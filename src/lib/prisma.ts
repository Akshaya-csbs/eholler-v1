import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance for Next.js.
 * In development, Next.js hot module reloading (HMR) creates new module instances on every change.
 * Attaching the client to globalThis ensures only one connection pool is created.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

