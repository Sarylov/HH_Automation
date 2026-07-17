-- CreateEnum
CREATE TYPE "WorkflowName" AS ENUM ('RESUME_MAINTAINER', 'RESUME_OPTIMIZER', 'VACANCY_SCANNER', 'APPLY_WORKER', 'CHAT_PROCESSOR', 'FOLLOW_UP_WORKER', 'HEALTH_CHECK');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "workflow" "WorkflowName" NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
    "correlation_id" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_status_idx" ON "workflow_runs"("workflow", "status");

-- CreateIndex
CREATE INDEX "workflow_runs_created_at_idx" ON "workflow_runs"("created_at");
