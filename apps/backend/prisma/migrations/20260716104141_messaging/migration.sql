-- CreateEnum
CREATE TYPE "ChatThreadStatus" AS ENUM ('OPEN', 'PROCESSED', 'NEEDS_MANUAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('EMPLOYER', 'APPLICANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatClassification" AS ENUM ('TEMPLATE', 'AI_QA', 'REJECTION', 'INTERVIEW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STOPPED');

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "employer_name" TEXT,
    "vacancy_title" TEXT,
    "url" TEXT,
    "status" "ChatThreadStatus" NOT NULL DEFAULT 'OPEN',
    "classification" "ChatClassification",
    "last_message_at" TIMESTAMP(3),
    "last_processed_at" TIMESTAMP(3),
    "notify_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "external_id" TEXT,
    "role" "ChatMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_states" (
    "id" UUID NOT NULL,
    "thread_id" UUID,
    "application_id" UUID,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'ACTIVE',
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "max_reminders" INTEGER NOT NULL DEFAULT 3,
    "last_reminder_at" TIMESTAMP(3),
    "next_reminder_at" TIMESTAMP(3),
    "last_employer_at" TIMESTAMP(3),
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_external_id_key" ON "chat_threads"("external_id");

-- CreateIndex
CREATE INDEX "chat_threads_status_last_message_at_idx" ON "chat_threads"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_threads_classification_idx" ON "chat_threads"("classification");

-- CreateIndex
CREATE INDEX "chat_messages_thread_id_sent_at_idx" ON "chat_messages"("thread_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_thread_id_external_id_key" ON "chat_messages"("thread_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_states_application_id_key" ON "follow_up_states"("application_id");

-- CreateIndex
CREATE INDEX "follow_up_states_status_next_reminder_at_idx" ON "follow_up_states"("status", "next_reminder_at");

-- CreateIndex
CREATE INDEX "follow_up_states_reminder_count_idx" ON "follow_up_states"("reminder_count");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_states" ADD CONSTRAINT "follow_up_states_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_states" ADD CONSTRAINT "follow_up_states_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
