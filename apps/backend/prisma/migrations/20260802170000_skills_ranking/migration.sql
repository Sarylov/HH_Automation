-- CreateEnum
CREATE TYPE "SkillsRankingRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "skills_ranking_runs" (
    "id" UUID NOT NULL,
    "status" "SkillsRankingRunStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "profiles" JSONB NOT NULL,
    "stats" JSONB,
    "correlation_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_ranking_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills_ranking_skills" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unique" TEXT NOT NULL,
    "counts" INTEGER NOT NULL,

    CONSTRAINT "skills_ranking_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skills_ranking_runs_status_created_at_idx" ON "skills_ranking_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "skills_ranking_runs_created_at_idx" ON "skills_ranking_runs"("created_at");

-- CreateIndex
CREATE INDEX "skills_ranking_skills_run_id_query_counts_idx" ON "skills_ranking_skills"("run_id", "query", "counts");

-- CreateIndex
CREATE UNIQUE INDEX "skills_ranking_skills_run_id_query_unique_key" ON "skills_ranking_skills"("run_id", "query", "unique");

-- AddForeignKey
ALTER TABLE "skills_ranking_skills" ADD CONSTRAINT "skills_ranking_skills_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "skills_ranking_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
