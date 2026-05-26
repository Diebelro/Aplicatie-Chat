-- AlterTable
ALTER TABLE "Visit" ADD COLUMN "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Visit" SET "lastVisitedAt" = "createdAt";

CREATE INDEX "Visit_profileUserId_lastVisitedAt_idx" ON "Visit"("profileUserId", "lastVisitedAt");
