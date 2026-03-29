-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "skills" TEXT[],
    "level" TEXT,
    "modality" TEXT,
    "salary" TEXT,
    "location" TEXT,
    "postedAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);
