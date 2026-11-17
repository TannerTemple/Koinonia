-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordSet" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "timezone" TEXT,
    "handoffHash" TEXT,
    "userId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_subject_key" ON "Identity"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_handoffHash_key" ON "OAuthState"("handoffHash");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
