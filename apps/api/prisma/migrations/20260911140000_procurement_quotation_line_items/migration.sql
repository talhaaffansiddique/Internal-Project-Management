-- Needed for gen_random_uuid() in the backfill below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "procurement_quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_quotation_items_quotationId_itemId_key" ON "procurement_quotation_items"("quotationId", "itemId");

-- CreateIndex
CREATE INDEX "procurement_quotation_items_quotationId_idx" ON "procurement_quotation_items"("quotationId");

-- AddForeignKey
ALTER TABLE "procurement_quotation_items" ADD CONSTRAINT "procurement_quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "procurement_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_quotation_items" ADD CONSTRAINT "procurement_quotation_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "procurement_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing quotations (created before per-item costs existed) each
-- get one line item per request item, splitting the lump amount evenly, so
-- the sum still matches the previous total.
DO $$
DECLARE
  q RECORD;
  it RECORD;
  item_count INT;
  idx INT;
BEGIN
  FOR q IN SELECT id, "requestId", amount FROM "procurement_quotations" LOOP
    SELECT COUNT(*) INTO item_count FROM "procurement_items" WHERE "requestId" = q."requestId";
    IF item_count > 0 THEN
      idx := 0;
      FOR it IN SELECT id FROM "procurement_items" WHERE "requestId" = q."requestId" ORDER BY "createdAt" ASC LOOP
        idx := idx + 1;
        INSERT INTO "procurement_quotation_items" ("id", "quotationId", "itemId", "cost", "createdAt")
        VALUES (gen_random_uuid(), q.id, it.id, ROUND((q.amount / item_count)::numeric, 2), CURRENT_TIMESTAMP);
      END LOOP;
    END IF;
  END LOOP;
END $$;
