-- CreateTable
CREATE TABLE "Friend" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Friend_fromUserId_idx" ON "Friend"("fromUserId");

-- CreateIndex
CREATE INDEX "Friend_toUserId_idx" ON "Friend"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Friend_fromUserId_toUserId_key" ON "Friend"("fromUserId", "toUserId");

-- AddForeignKey
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
