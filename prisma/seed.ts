import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 シードデータの投入を開始します...');

  // 既存データをクリア
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  
  // テストユーザーを作成
  const testUsers = [
    {
      email: 'admin@example.com',
      name: '管理者',
      password: 'admin123',
      role: 'ADMIN'
    },
    {
      email: 'user1@example.com',
      name: 'テストユーザー1',
      password: 'password123',
      role: 'USER'
    },
    {
      email: 'user2@example.com',
      name: 'テストユーザー2',
      password: 'password123',
      role: 'USER'
    },
    {
      email: 'guest@example.com',
      name: 'ゲストユーザー',
      password: 'guest123',
      role: 'GUEST'
    }
  ];

  for (const userData of testUsers) {
    const hashedPassword = await hash(userData.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ ユーザー作成: ${user.name} (${user.email})`);
  }

  // 統計情報を表示
  const userCount = await prisma.user.count();
  console.log(`\n📊 作成結果:`);
  console.log(`   - ユーザー数: ${userCount}`);
  
  // 作成したユーザーの一覧を表示
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });
  
  console.log('\n👥 作成されたユーザー:');
  users.forEach(user => {
    console.log(`   - ${user.name} (${user.email})`);
  });
  
  console.log('\n🎉 シードデータの投入が完了しました！');
  console.log('\n📝 ログイン情報:');
  testUsers.forEach(user => {
    console.log(`   - Email: ${user.email}, Password: ${user.password}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ シードデータの投入に失敗しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });