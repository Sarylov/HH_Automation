-- CreateEnum
CREATE TYPE "VacancyStatus" AS ENUM ('NEW', 'QUEUED', 'APPLIED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('STUB', 'APPLIED', 'FAILED', 'NEEDS_MANUAL');

-- CreateEnum
CREATE TYPE "ApplyJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "vacancies" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "company" TEXT,
    "salary" TEXT,
    "snippet" TEXT,
    "status" "VacancyStatus" NOT NULL DEFAULT 'NEW',
    "raw" JSONB,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "vacancy_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'STUB',
    "cover_letter" TEXT,
    "analysis" JSONB,
    "error_message" TEXT,
    "correlation_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apply_jobs" (
    "id" UUID NOT NULL,
    "vacancy_id" UUID NOT NULL,
    "status" "ApplyJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "correlation_id" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apply_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vacancies_external_id_key" ON "vacancies"("external_id");

-- CreateIndex
CREATE INDEX "vacancies_status_idx" ON "vacancies"("status");

-- CreateIndex
CREATE INDEX "vacancies_last_seen_at_idx" ON "vacancies"("last_seen_at");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_vacancy_id_key" ON "applications"("vacancy_id");

-- CreateIndex
CREATE INDEX "apply_jobs_status_queued_at_idx" ON "apply_jobs"("status", "queued_at");

-- CreateIndex
CREATE INDEX "apply_jobs_vacancy_id_status_idx" ON "apply_jobs"("vacancy_id", "status");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apply_jobs" ADD CONSTRAINT "apply_jobs_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
