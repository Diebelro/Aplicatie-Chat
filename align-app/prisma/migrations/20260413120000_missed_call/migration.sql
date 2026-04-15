-- CreateTable
CREATE TABLE "MissedCall" (
    "id" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "audioOnly" BOOLEAN NOT NULL DEFAULT false,
    "ringAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissedCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissedCall_toUserId_ringAt_idx" ON "MissedCall"("toUserId", "ringAt");
