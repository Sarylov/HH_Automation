-- CreateEnum
CREATE TYPE "AuthSessionStatus" AS ENUM ('UNKNOWN', 'UP', 'DOWN');

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "status" "AuthSessionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "storage_path" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_sessions_status_idx" ON "auth_sessions"("status");
