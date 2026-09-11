-- Needed for gen_random_uuid() in the backfill below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "procurement_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" "ProcurementType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_items_requestId_idx" ON "procurement_items"("requestId");

-- AddForeignKey
ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one line item per existing request, carrying over its old
-- type/itemDescription/quantity columns before those columns are dropped.
INSERT INTO "procurement_items" ("id", "requestId", "type", "description", "quantity", "createdAt")
SELECT gen_random_uuid(), "id", "type", "itemDescription", "quantity", "createdAt"
FROM "procurement_requests";

-- AlterTable: line-item fields now live on procurement_items
ALTER TABLE "procurement_requests" DROP COLUMN "type";
ALTER TABLE "procurement_requests" DROP COLUMN "itemDescription";
ALTER TABLE "procurement_requests" DROP COLUMN "quantity";
