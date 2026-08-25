import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client/index.js';
import { APP_CONSTANTS } from '../../src/common/constants/app.constants';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!rawEmail || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the admin user');
  }

  const email = rawEmail.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const hashedPassword = await bcrypt.hash(password, APP_CONSTANTS.SALT_ROUNDS);

  await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      password: hashedPassword,
      role: Role.ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log(`Admin user seeded: ${email}`);
}
