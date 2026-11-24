-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP');

-- DropIndex
DROP INDEX "Ticket_sourceMessageId_key";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channel_sourceMessageId_key" ON "Ticket"("channel", "sourceMessageId");

