-- AlterTable: FCM opțional, VoIP APNs pentru iOS
ALTER TABLE "UserPushDevice" ALTER COLUMN "fcmToken" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserPushDevice" ADD COLUMN "apnsVoipToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserPushDevice_apnsVoipToken_key" ON "UserPushDevice"("apnsVoipToken");
