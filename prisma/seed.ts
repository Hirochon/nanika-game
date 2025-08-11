import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 シードデータの投入を開始します...');

  // 既存データをクリア（順序が重要）
  await prisma.message.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // テストユーザーを作成
  const testUsers = [
    {
      email: 'admin@example.com',
      name: '管理者',
      password: 'admin123',
      role: 'ADMIN',
    },
    {
      email: 'user1@example.com',
      name: 'テストユーザー1',
      password: 'password123',
      role: 'USER',
    },
    {
      email: 'user2@example.com',
      name: 'テストユーザー2',
      password: 'password123',
      role: 'USER',
    },
    {
      email: 'guest@example.com',
      name: 'ゲストユーザー',
      password: 'guest123',
      role: 'GUEST',
    },
  ];

  for (const userData of testUsers) {
    const hashedPassword = await hash(userData.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ ユーザー作成: ${user.name} (${user.email})`);
  }

  // チャットルームを作成
  const createdUsers = await prisma.user.findMany({
    orderBy: { id: 'asc' },
  });

  const chatRooms = [
    {
      type: 'GROUP' as const,
      name: 'General Chat',
      description: '全体チャット用のルームです',
      isActive: true,
    },
    {
      type: 'GROUP' as const,
      name: 'Game Discussion',
      description: 'ゲームについて話し合いましょう',
      isActive: true,
    },
    {
      type: 'DIRECT' as const,
      name: null,
      description: null,
      isActive: true,
    },
  ];

  const createdRooms = [];
  for (const roomData of chatRooms) {
    const room = await prisma.chatRoom.create({
      data: {
        type: roomData.type,
        name: roomData.name,
        description: roomData.description,
        isActive: roomData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    createdRooms.push(room);
    console.log(`✅ チャットルーム作成: ${room.name || `Direct Chat ${room.id}`}`);
  }

  // チャットメンバーを作成（全ユーザーを全グループチャットに追加）
  for (const room of createdRooms) {
    if (room.type === 'GROUP') {
      for (let i = 0; i < createdUsers.length; i++) {
        const user = createdUsers[i];
        await prisma.chatMember.create({
          data: {
            userId: user.id,
            chatRoomId: room.id,
            role: i === 0 ? 'ADMIN' : 'MEMBER', // 最初のユーザーを管理者に
            isActive: true,
            joinedAt: new Date(),
            lastReadAt: new Date(),
          },
        });
      }
      console.log(`✅ チャットメンバー作成: ${room.name} (${createdUsers.length}人)`);
    }
  }

  // ダイレクトチャットのメンバー追加（user1とuser2）
  const directRoom = createdRooms.find((r) => r.type === 'DIRECT');
  if (directRoom && createdUsers.length >= 2) {
    await prisma.chatMember.create({
      data: {
        userId: createdUsers[1].id, // user1
        chatRoomId: directRoom.id,
        role: 'MEMBER',
        isActive: true,
        joinedAt: new Date(),
        lastReadAt: new Date(),
      },
    });
    await prisma.chatMember.create({
      data: {
        userId: createdUsers[2].id, // user2
        chatRoomId: directRoom.id,
        role: 'MEMBER',
        isActive: true,
        joinedAt: new Date(),
        lastReadAt: new Date(),
      },
    });
    console.log(`✅ ダイレクトチャット設定: user1とuser2`);
  }

  // サンプルメッセージを作成
  const generalRoom = createdRooms.find((r) => r.name === 'General Chat');
  if (generalRoom) {
    const sampleMessages = [
      {
        content: 'こんにちは！チャット機能のテストです。',
        senderId: createdUsers[0].id,
        messageType: 'TEXT' as const,
      },
      {
        content: 'よろしくお願いします！',
        senderId: createdUsers[1].id,
        messageType: 'TEXT' as const,
      },
      {
        content: 'チャット機能が正常に動作していることを確認しています。',
        senderId: createdUsers[0].id,
        messageType: 'TEXT' as const,
      },
    ];

    for (let i = 0; i < sampleMessages.length; i++) {
      const messageData = sampleMessages[i];
      await prisma.message.create({
        data: {
          content: messageData.content,
          messageType: messageData.messageType,
          senderId: messageData.senderId,
          chatRoomId: generalRoom.id,
          sentAt: new Date(Date.now() + i * 1000), // 1秒間隔でメッセージを作成
          isDeleted: false,
        },
      });
    }
    console.log(`✅ サンプルメッセージ作成: ${sampleMessages.length}件`);
  }

  // 統計情報を表示
  const userCount = await prisma.user.count();
  const roomCount = await prisma.chatRoom.count();
  const memberCount = await prisma.chatMember.count();
  const messageCount = await prisma.message.count();
  console.log(`\n📊 作成結果:`);
  console.log(`   - ユーザー数: ${userCount}`);
  console.log(`   - チャットルーム数: ${roomCount}`);
  console.log(`   - チャットメンバー数: ${memberCount}`);
  console.log(`   - メッセージ数: ${messageCount}`);

  // 作成したユーザーの一覧を表示
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  console.log('\n👥 作成されたユーザー:');
  users.forEach((user) => {
    console.log(`   - ${user.name} (${user.email})`);
  });

  // 作成されたチャットルームを表示
  const rooms = await prisma.chatRoom.findMany({
    include: {
      _count: {
        select: { members: true, messages: true },
      },
    },
  });

  console.log('\n💬 作成されたチャットルーム:');
  rooms.forEach((room) => {
    console.log(
      `   - ${room.name || `Direct Chat ${room.id}`} (${room.type}) - メンバー: ${room._count.members}人, メッセージ: ${room._count.messages}件`
    );
  });

  console.log('\n🎉 シードデータの投入が完了しました！');
  console.log('\n📝 ログイン情報:');
  testUsers.forEach((user) => {
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
