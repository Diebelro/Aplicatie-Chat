-- Dedupe per call room + FK către User (ștergere cont).
ALTER TABLE "MissedCall" ADD COLUMN "roomId" TEXT;

UPDATE "MissedCall" SET "roomId" = "id" WHERE "roomId" IS NULL;

ALTER TABLE "MissedCall" ALTER COLUMN "roomId" SET NOT NULL;

CREATE UNIQUE INDEX "MissedCall_roomId_key" ON "MissedCall"("roomId");

ALTER TABLE "MissedCall" ADD CONSTRAINT "MissedCall_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
