import { PrismaClient } from '@prisma/client/index.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Seed runners land in Stage 10 (prisma/seeds/admin.seed.ts).
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
