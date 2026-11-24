-- AlterEnum
ALTER TYPE "Reaction" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "failureReason" TEXT;
