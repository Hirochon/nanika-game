-- CreateEnum
CREATE TYPE "public"."chat_room_type" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "public"."member_role" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "public"."message_type" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateTable
CREATE TABLE "public"."chat_rooms" (
    "id" SERIAL NOT NULL,
    "type" "public"."chat_room_type" NOT NULL DEFAULT 'DIRECT',
    "name" VARCHAR(100),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chat_members" (
    "id" SERIAL NOT NULL,
    "chat_room_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "public"."member_role" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" SERIAL NOT NULL,
    "chat_room_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" "public"."message_type" NOT NULL DEFAULT 'TEXT',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_chat_rooms_type_active" ON "public"."chat_rooms"("type", "is_active");

-- CreateIndex
CREATE INDEX "idx_chat_rooms_created_at" ON "public"."chat_rooms"("created_at");

-- CreateIndex
CREATE INDEX "idx_chat_members_room_active" ON "public"."chat_members"("chat_room_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_chat_members_user_active" ON "public"."chat_members"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "chat_members_chat_room_id_user_id_key" ON "public"."chat_members"("chat_room_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_messages_room_sent" ON "public"."messages"("chat_room_id", "sent_at");

-- CreateIndex
CREATE INDEX "idx_messages_sender_sent_at" ON "public"."messages"("sender_id", "sent_at");

-- CreateIndex
CREATE INDEX "idx_messages_room_type_sent" ON "public"."messages"("chat_room_id", "message_type", "sent_at");

-- AddForeignKey
ALTER TABLE "public"."chat_members" ADD CONSTRAINT "chat_members_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
