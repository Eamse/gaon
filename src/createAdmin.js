import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** 지정된 관리자 계정 목록을 데이터베이스에 생성하거나 업데이트합니다. */
async function main() {
  const admins = [
    { id: 'master', pw: 'qwer1234!', name: 'master' },
    { id: 'admin', pw: 'password123!', name: 'admin' },
  ];

  console.log(`🚀 총 ${admins.length}개의 계정 생성을 시작합니다...`);

  for (const account of admins) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(account.pw, salt);

    try {
      await prisma.user.upsert({
        where: { username: account.id },
        update: {
          password: hashedPassword,
          name: account.name,
        },
        create: {
          username: account.id,
          password: hashedPassword,
          name: account.name,
        },
      });
      console.log(`✅ 성공: ${account.id} (비번: ${account.pw})`);
    } catch (error) {
      console.error(`❌ 실패 (${account.id}):`, error.message);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
