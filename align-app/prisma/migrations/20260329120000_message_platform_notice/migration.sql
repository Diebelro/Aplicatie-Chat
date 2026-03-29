-- Mesaje „notificare platformă” (moderare discretă în firul de chat).
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isPlatformNotice" BOOLEAN NOT NULL DEFAULT false;
