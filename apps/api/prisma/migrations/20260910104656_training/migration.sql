-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "TrainingAck" AS ENUM ('PENDING', 'CONFIRMED', 'NEEDS_FOLLOW_UP');

-- CreateTable
CREATE TABLE "trainings" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "categoryKey" TEXT,
    "type" "TrainingType" NOT NULL DEFAULT 'GROUP',
    "trainerId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "statusKey" TEXT NOT NULL DEFAULT 'requested',
    "completedAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_participants" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ackStatus" "TrainingAck" NOT NULL DEFAULT 'PENDING',
    "ackAt" TIMESTAMP(3),
    "ackComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_checklist_items" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainings_number_key" ON "trainings"("number");

-- CreateIndex
CREATE INDEX "trainings_statusKey_idx" ON "trainings"("statusKey");

-- CreateIndex
CREATE INDEX "trainings_trainerId_idx" ON "trainings"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "training_participants_trainingId_userId_key" ON "training_participants"("trainingId", "userId");

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_checklist_items" ADD CONSTRAINT "training_checklist_items_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
