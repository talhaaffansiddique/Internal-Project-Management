-- CreateEnum
CREATE TYPE "TicketVisibility" AS ENUM ('PRIVATE', 'TEAM');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB,
    "visibility" "TicketVisibility" NOT NULL DEFAULT 'PRIVATE',
    "teamId" TEXT,
    "priority" TEXT,
    "statusKey" TEXT NOT NULL DEFAULT 'new',
    "categoryId" TEXT,
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_number_key" ON "tickets"("number");

-- CreateIndex
CREATE INDEX "tickets_statusKey_idx" ON "tickets"("statusKey");

-- CreateIndex
CREATE INDEX "tickets_requesterId_idx" ON "tickets"("requesterId");

-- CreateIndex
CREATE INDEX "tickets_assigneeId_idx" ON "tickets"("assigneeId");

-- CreateIndex
CREATE INDEX "tickets_teamId_idx" ON "tickets"("teamId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
