import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // ユーザー数を確認
    const userCount = await prisma.user.count();
    console.log(`ユーザー数: ${userCount}`);

    // 全ユーザーを取得
    const users = await prisma.user.findMany();
    console.log('ユーザー一覧:', users);

    // セッション数を確認
    const sessionCount = await prisma.session.count();
    console.log(`セッション数: ${sessionCount}`);
  } catch (error) {
    console.error('データベース確認エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
