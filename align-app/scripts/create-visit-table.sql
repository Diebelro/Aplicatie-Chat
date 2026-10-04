CREATE TABLE IF NOT EXISTS "Visit" (
  "id" TEXT NOT NULL,
  "viewerUserId" TEXT NOT NULL,
  "profileUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Visit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Visit_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Visit_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Visit_viewerUserId_profileUserId_key" ON "Visit"("viewerUserId","profileUserId");
CREATE INDEX IF NOT EXISTS "Visit_viewerUserId_idx" ON "Visit"("viewerUserId");
CREATE INDEX IF NOT EXISTS "Visit_profileUserId_idx" ON "Visit"("profileUserId");
CREATE INDEX IF NOT EXISTS "Visit_profileUserId_lastVisitedAt_idx" ON "Visit"("profileUserId","lastVisitedAt");
