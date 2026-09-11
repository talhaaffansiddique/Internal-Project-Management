-- AlterEnum: new post-RFQ Director approval stage, between WITH_PURCHASING and ORDERED
ALTER TYPE "ProcurementStatus" ADD VALUE 'AWAITING_FINAL_APPROVAL';

-- AlterTable: creator-assigned RFQ owner (nullable — null = any Purchasing/Finance user, legacy behavior)
ALTER TABLE "procurement_requests" ADD COLUMN "assignedToId" TEXT;

-- CreateIndex
CREATE INDEX "procurement_requests_assignedToId_idx" ON "procurement_requests"("assignedToId");

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
