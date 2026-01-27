import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. 관리자 계정 목록 (원하는 대로 수정 가능)
  const admins = [
    { id: 'master', pw: 'qwer1234!', name: 'master' },
    { id: 'admin', pw: 'password123!', name: 'admin' },
  ];

  console.log(`🚀 총 ${admins.length}개의 계정 생성을 시작합니다...`);

  // 2. 반복문으로 하나씩 생성 또는 업데이트
  for (const account of admins) {
    // 비밀번호 암호화
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(account.pw, salt);

    try {
      // upsert: 없으면 만들고(create), 있으면 업데이트(update)
      await prisma.user.upsert({
        where: { username: account.id },
        update: {
          password: hashedPassword,
          name: account.name
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
