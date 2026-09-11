-- CreateEnum
CREATE TYPE "ProcurementType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('SUBMITTED', 'AWAITING_DIRECTOR', 'WITH_PURCHASING', 'ORDERED', 'DELIVERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('PENDING', 'SELECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "ProcurementType" NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "businessReason" TEXT NOT NULL,
    "quantity" TEXT,
    "requesterId" TEXT NOT NULL,
    "departmentId" TEXT,
    "statusKey" "ProcurementStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_quotations" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "quotationDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "deliveryTime" TEXT,
    "comments" TEXT,
    "attachmentId" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_requests_number_key" ON "procurement_requests"("number");

-- CreateIndex
CREATE INDEX "procurement_requests_statusKey_idx" ON "procurement_requests"("statusKey");

-- CreateIndex
CREATE INDEX "procurement_requests_requesterId_idx" ON "procurement_requests"("requesterId");

-- CreateIndex
CREATE INDEX "procurement_quotations_requestId_idx" ON "procurement_quotations"("requestId");

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_quotations" ADD CONSTRAINT "procurement_quotations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_quotations" ADD CONSTRAINT "procurement_quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
