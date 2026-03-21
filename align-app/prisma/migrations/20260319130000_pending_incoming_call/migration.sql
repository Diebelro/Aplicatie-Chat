-- CreateTable
CREATE TABLE "PendingIncomingCall" (
    "toUserId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "audioOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingIncomingCall_pkey" PRIMARY KEY ("toUserId")
);
