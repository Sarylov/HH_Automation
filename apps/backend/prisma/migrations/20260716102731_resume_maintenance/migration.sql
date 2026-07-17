-- CreateEnum
CREATE TYPE "ResumeActionType" AS ENUM ('RAISE', 'OPTIMIZE', 'SKIP');

-- CreateEnum
CREATE TYPE "ResumeActionStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "fields_snapshot" JSONB,
    "last_raised_at" TIMESTAMP(3),
    "last_optimized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_actions" (
    "id" UUID NOT NULL,
    "resume_id" UUID,
    "type" "ResumeActionType" NOT NULL,
    "status" "ResumeActionStatus" NOT NULL,
    "reason" TEXT,
    "changelog" JSONB,
    "snapshot" JSONB,
    "correlation_id" TEXT,
    "workflow_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumes_external_id_key" ON "resumes"("external_id");

-- CreateIndex
CREATE INDEX "resumes_last_raised_at_idx" ON "resumes"("last_raised_at");

-- CreateIndex
CREATE INDEX "resumes_last_optimized_at_idx" ON "resumes"("last_optimized_at");

-- CreateIndex
CREATE INDEX "resume_actions_type_status_created_at_idx" ON "resume_actions"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "resume_actions_resume_id_type_created_at_idx" ON "resume_actions"("resume_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "resume_actions" ADD CONSTRAINT "resume_actions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
