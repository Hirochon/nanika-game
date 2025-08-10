#!/bin/bash

# 色付きメッセージ出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Nanika Game Setup Script              ║${NC}"
echo -e "${BLUE}║      GitHub Codespaces 対応版              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo

# フルセットアップかどうかのフラグ
FULL_SETUP=false
if [ "$1" = "--full" ]; then
  FULL_SETUP=true
  echo -e "${YELLOW}📦 フルセットアップモードで実行します${NC}"
else
  echo -e "${GREEN}🚀 クイックセットアップモードで実行します${NC}"
fi

# 1. 既存のプロセスをクリーンアップ
echo -e "\n${YELLOW}🧹 既存のプロセスをクリーンアップ中...${NC}"

# Node.jsプロセス（開発サーバー）を停止
if pgrep -f "vite" > /dev/null; then
  echo "  - Vite開発サーバーを停止中..."
  pkill -f "vite"
fi

if pgrep -f "prisma studio" > /dev/null; then
  echo "  - Prisma Studioを停止中..."
  pkill -f "prisma studio"
fi

# Dockerコンテナを停止・削除
echo "  - Dockerコンテナをクリーンアップ中..."
docker compose down 2>/dev/null || true
docker rm -f nanika-game-db 2>/dev/null || true

# ポートを解放（念のため）
echo "  - ポート5173、5432、5555を解放中..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5432 | xargs kill -9 2>/dev/null || true
lsof -ti:5555 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✅ クリーンアップ完了${NC}"

# 2. 依存関係のインストール（フルセットアップ時のみ）
if [ "$FULL_SETUP" = true ]; then
  echo -e "\n${YELLOW}📦 依存関係をインストール中...${NC}"
  npm install
  echo -e "${GREEN}✅ 依存関係のインストール完了${NC}"
fi

# 3. 環境変数ファイルの確認
echo -e "\n${YELLOW}🔐 環境変数を確認中...${NC}"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ .env.exampleから.envを作成しました${NC}"
  else
    # デフォルトの.envを作成
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://nanika_user:nanika_password@localhost:5432/nanika_game?schema=public"

# Application
NODE_ENV=development
EOF
    echo -e "${GREEN}✅ デフォルトの.envファイルを作成しました${NC}"
  fi
else
  echo -e "${GREEN}✅ 既存の.envファイルを使用します${NC}"
fi

# 4. PostgreSQLデータベースを起動
echo -e "\n${YELLOW}🐘 PostgreSQLデータベースを起動中...${NC}"
docker compose up -d postgres

# データベースの起動を待つ
echo "  - データベースの起動を待機中..."
for i in {1..30}; do
  if docker exec nanika-game-db pg_isready -U nanika_user -d nanika_game &>/dev/null; then
    echo -e "${GREEN}✅ データベース起動完了${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ データベースの起動に失敗しました${NC}"
    exit 1
  fi
  sleep 1
done

# 5. Prismaのセットアップ
echo -e "\n${YELLOW}🔧 Prismaをセットアップ中...${NC}"

# Prismaクライアントの生成
echo "  - Prismaクライアントを生成中..."
npx prisma generate

# マイグレーションの実行
echo "  - データベースマイグレーションを実行中..."
npx prisma migrate reset --force --skip-seed

echo "  - 初期マイグレーションを適用中..."
npx prisma migrate dev --name init

# シードデータの投入
echo "  - シードデータを投入中..."
npm run db:seed

echo -e "${GREEN}✅ Prismaセットアップ完了${NC}"

# 6. 開発サーバーの起動
echo -e "\n${YELLOW}🚀 開発サーバーを起動中...${NC}"
nohup npm run dev > dev.log 2>&1 &
DEV_PID=$!

# サーバーの起動を待つ
echo "  - サーバーの起動を待機中..."
for i in {1..30}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 開発サーバー起動完了${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${YELLOW}⚠️  開発サーバーの起動確認がタイムアウトしました${NC}"
    echo "  手動で 'npm run dev' を実行してください"
  fi
  sleep 1
done

# 7. Prisma Studioの起動（オプション）
echo -e "\n${YELLOW}📊 Prisma Studioを起動中...${NC}"
nohup npx prisma studio > prisma-studio.log 2>&1 &
STUDIO_PID=$!
echo -e "${GREEN}✅ Prisma Studio起動完了${NC}"

# 完了メッセージ
echo
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         セットアップ完了！                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo
echo -e "${BLUE}📋 起動したサービス:${NC}"
echo -e "  • 開発サーバー: ${GREEN}http://localhost:5173${NC}"
echo -e "  • Prisma Studio: ${GREEN}http://localhost:5555${NC}"
echo -e "  • PostgreSQL: ${GREEN}localhost:5432${NC}"
echo
echo -e "${BLUE}📝 ログイン情報:${NC}"
echo -e "  • Admin: admin@example.com / admin123"
echo -e "  • User1: user1@example.com / password123"
echo -e "  • User2: user2@example.com / password123"
echo -e "  • Guest: guest@example.com / guest123"
echo
echo -e "${YELLOW}💡 ヒント:${NC}"
echo -e "  • ログ確認: tail -f dev.log"
echo -e "  • DB確認: npm run db:seed"
echo -e "  • 停止: docker compose down"
echo
echo -e "${GREEN}Happy Coding! 🎮${NC}"