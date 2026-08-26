import { PrismaClient } from '@prisma/client/index.js';

export async function cleanupE2eData(prisma: PrismaClient): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? 'admin@example.com';

  await prisma.session.deleteMany({
    where: {
      user: {
        email: { not: adminEmail },
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: { not: adminEmail },
    },
  });
}
