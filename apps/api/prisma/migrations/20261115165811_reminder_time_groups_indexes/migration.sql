-- DropIndex
DROP INDEX "Interaction_contactId_day_idx";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reminderTime" TEXT;

-- CreateIndex
CREATE INDEX "Contact_userId_archivedAt_idx" ON "Contact"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Contact_userId_linkedUserId_idx" ON "Contact"("userId", "linkedUserId");

-- CreateIndex
CREATE INDEX "DailyIntention_intentionId_idx" ON "DailyIntention"("intentionId");

-- CreateIndex
CREATE INDEX "Interaction_contactId_day_occurredAt_idx" ON "Interaction"("contactId", "day", "occurredAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
