-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "erpRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "erpRegisteredById" TEXT,
ADD COLUMN     "erpTicketNumber" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isErpUser" BOOLEAN NOT NULL DEFAULT false;
