-- Motivul blocării, vizibil utilizatorului pe /cont-blocat.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
