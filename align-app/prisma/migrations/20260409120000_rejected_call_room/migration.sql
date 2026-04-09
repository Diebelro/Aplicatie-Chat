-- Persist rejected call room for caller polling (serverless instances don't share memory).
CREATE TABLE "RejectedCallRoom" (
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RejectedCallRoom_pkey" PRIMARY KEY ("roomId")
);
