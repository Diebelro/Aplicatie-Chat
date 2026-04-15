-- CreateTable
CREATE TABLE "AnsweredCallRoom" (
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnsweredCallRoom_pkey" PRIMARY KEY ("roomId")
);
