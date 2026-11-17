-- CreateTable
CREATE TABLE "UsageCount" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageCount_day_idx" ON "UsageCount"("day");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCount_day_kind_name_platform_key" ON "UsageCount"("day", "kind", "name", "platform");
