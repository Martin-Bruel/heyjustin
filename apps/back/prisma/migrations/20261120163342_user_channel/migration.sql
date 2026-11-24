-- Written by hand: existing users talk to us on WhatsApp, their phone number becomes their channel identity.

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'DISCORD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "channel" "Channel";
ALTER TABLE "User" ADD COLUMN "externalId" TEXT;

-- Data
UPDATE "User" SET "channel" = 'WHATSAPP', "externalId" = "phoneNumber";

ALTER TABLE "User" ALTER COLUMN "channel" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "externalId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_channel_externalId_key" ON "User"("channel", "externalId");

-- DropIndex
DROP INDEX "User_phoneNumber_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phoneNumber";
