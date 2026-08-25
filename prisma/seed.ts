import '../src/config/load-env';
import { PrismaClient } from '@prisma/client/index.js';
import { seedAdmin } from './seeds/admin.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedAdmin(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
