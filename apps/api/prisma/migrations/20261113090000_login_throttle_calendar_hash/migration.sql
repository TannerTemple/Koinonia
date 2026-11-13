-- Calendar feed secret: keep only its SHA-256 (existing links keep working).
ALTER TABLE "User" ADD COLUMN "calendarTokenHash" TEXT;
UPDATE "User" SET "calendarTokenHash" = encode(sha256(convert_to("calendarToken", 'UTF8')), 'hex') WHERE "calendarToken" IS NOT NULL;
DROP INDEX "User_calendarToken_key";
ALTER TABLE "User" DROP COLUMN "calendarToken";
CREATE UNIQUE INDEX "User_calendarTokenHash_key" ON "User"("calendarTokenHash");

-- Sign-in lockout shared by every API instance.
CREATE TABLE "LoginThrottle" (
    "email" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("email")
);
