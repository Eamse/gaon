import prisma from './db.js';
import bcrypt from 'bcryptjs';

async function main() {
  // 1. 관리자 계정
  const admins = [
    { id: 'master', pw: 'qwer1234!', name: 'master' },
    { id: 'admin', pw: 'password123!', name: 'admin' },
  ];

  console.log(`총 ${admins.length}개의 계정 생성을 시작합니다...`);

  // 2. 반복문으로 하나씩 생성
  for (const account of admins) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(account.pw, salt);

    try {
      await prisma.user.upsert({
        where: { username: account.id },
        update: { password: hashedPassword, name: account.name }, // 이미 있으면 비번/이름 업데이트
        create: {
          username: account.id,
          password: hashedPassword,
          name: account.name,
        },
      });
      console.log(`✅ 성공: ${account.id}`);
    } catch (error) {
      console.error(`❌ 실패 (${account.id}):`, error.message);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
