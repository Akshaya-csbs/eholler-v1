-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'PENDING');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('GOOGLE_PLACES', 'WEBSITE', 'GOOGLE_SEARCH_CONSOLE', 'GOOGLE_ANALYTICS');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "GBPFieldStatus" AS ENUM ('NO_CHANGES_REQUIRED', 'MISSING', 'NEEDS_IMPROVEMENT', 'UNABLE_TO_VERIFY');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('MISSING_SEO_FIELD', 'INCONSISTENT_INFO', 'INCOMPLETE_DESCRIPTION', 'MISSING_META', 'CONTENT_OPTIMIZATION', 'SEARCH_CONSOLE', 'LOCAL_SEO_PRIORITY');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "EffortLevel" AS ENUM ('QUICK_WIN', 'MODERATE', 'SIGNIFICANT');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationMembership" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "city" TEXT,
    "category" TEXT,
    "phone" TEXT,
    "websiteUrl" TEXT,
    "mapUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER DEFAULT 0,
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSource" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceIdentifier" TEXT,
    "config" JSONB,
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleUserId" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "scopes" TEXT[],
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchConsoleProperty" (
    "id" TEXT NOT NULL,
    "googleConnectionId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "permissionLevel" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchConsoleProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsProperty" (
    "id" TEXT NOT NULL,
    "googleConnectionId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "displayName" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredByUserId" TEXT,
    "authorityScore" INTEGER,
    "mapsRank" INTEGER,
    "gbpHealthScore" INTEGER,
    "completenessScore" INTEGER,
    "missingFieldsCount" INTEGER DEFAULT 0,
    "inconsistentFieldsCount" INTEGER DEFAULT 0,
    "summary" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "rawData" JSONB NOT NULL,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GBPFieldAudit" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "GBPFieldStatus" NOT NULL,
    "currentValue" TEXT,
    "recommendedContent" TEXT,
    "whyItMatters" TEXT,
    "action" TEXT,
    "confidence" TEXT,
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "verifiable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GBPFieldAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "category" "RecommendationCategory" NOT NULL,
    "evidence" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "suggestedContent" TEXT,
    "estimatedEffort" "EffortLevel" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "searchConsolePropertyId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "businessId" TEXT,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "averageCtr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queryData" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "analyticsPropertyId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "businessId" TEXT,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION,
    "metricsData" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE INDEX "Organisation_slug_idx" ON "Organisation"("slug");

-- CreateIndex
CREATE INDEX "OrganisationMembership_organisationId_idx" ON "OrganisationMembership"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationMembership_userId_idx" ON "OrganisationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMembership_organisationId_userId_key" ON "OrganisationMembership"("organisationId", "userId");

-- CreateIndex
CREATE INDEX "Business_organisationId_idx" ON "Business"("organisationId");

-- CreateIndex
CREATE INDEX "Business_placeId_idx" ON "Business"("placeId");

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- CreateIndex
CREATE INDEX "BusinessSource_businessId_idx" ON "BusinessSource"("businessId");

-- CreateIndex
CREATE INDEX "BusinessSource_organisationId_idx" ON "BusinessSource"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSource_businessId_sourceType_sourceIdentifier_key" ON "BusinessSource"("businessId", "sourceType", "sourceIdentifier");

-- CreateIndex
CREATE INDEX "GoogleConnection_organisationId_idx" ON "GoogleConnection"("organisationId");

-- CreateIndex
CREATE INDEX "GoogleConnection_status_idx" ON "GoogleConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_organisationId_email_key" ON "GoogleConnection"("organisationId", "email");

-- CreateIndex
CREATE INDEX "SearchConsoleProperty_googleConnectionId_idx" ON "SearchConsoleProperty"("googleConnectionId");

-- CreateIndex
CREATE INDEX "SearchConsoleProperty_organisationId_idx" ON "SearchConsoleProperty"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConsoleProperty_organisationId_siteUrl_key" ON "SearchConsoleProperty"("organisationId", "siteUrl");

-- CreateIndex
CREATE INDEX "AnalyticsProperty_googleConnectionId_idx" ON "AnalyticsProperty"("googleConnectionId");

-- CreateIndex
CREATE INDEX "AnalyticsProperty_organisationId_idx" ON "AnalyticsProperty"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsProperty_organisationId_propertyId_key" ON "AnalyticsProperty"("organisationId", "propertyId");

-- CreateIndex
CREATE INDEX "AuditRun_organisationId_idx" ON "AuditRun"("organisationId");

-- CreateIndex
CREATE INDEX "AuditRun_businessId_idx" ON "AuditRun"("businessId");

-- CreateIndex
CREATE INDEX "AuditRun_status_idx" ON "AuditRun"("status");

-- CreateIndex
CREATE INDEX "AuditRun_createdAt_idx" ON "AuditRun"("createdAt");

-- CreateIndex
CREATE INDEX "SourceSnapshot_auditRunId_idx" ON "SourceSnapshot"("auditRunId");

-- CreateIndex
CREATE INDEX "SourceSnapshot_businessId_idx" ON "SourceSnapshot"("businessId");

-- CreateIndex
CREATE INDEX "SourceSnapshot_organisationId_idx" ON "SourceSnapshot"("organisationId");

-- CreateIndex
CREATE INDEX "GBPFieldAudit_auditRunId_idx" ON "GBPFieldAudit"("auditRunId");

-- CreateIndex
CREATE INDEX "GBPFieldAudit_organisationId_idx" ON "GBPFieldAudit"("organisationId");

-- CreateIndex
CREATE INDEX "GBPFieldAudit_businessId_idx" ON "GBPFieldAudit"("businessId");

-- CreateIndex
CREATE INDEX "GBPFieldAudit_status_idx" ON "GBPFieldAudit"("status");

-- CreateIndex
CREATE INDEX "AIRecommendation_auditRunId_idx" ON "AIRecommendation"("auditRunId");

-- CreateIndex
CREATE INDEX "AIRecommendation_organisationId_idx" ON "AIRecommendation"("organisationId");

-- CreateIndex
CREATE INDEX "AIRecommendation_businessId_idx" ON "AIRecommendation"("businessId");

-- CreateIndex
CREATE INDEX "AIRecommendation_status_idx" ON "AIRecommendation"("status");

-- CreateIndex
CREATE INDEX "AIRecommendation_severity_idx" ON "AIRecommendation"("severity");

-- CreateIndex
CREATE INDEX "SearchPerformanceSnapshot_searchConsolePropertyId_idx" ON "SearchPerformanceSnapshot"("searchConsolePropertyId");

-- CreateIndex
CREATE INDEX "SearchPerformanceSnapshot_organisationId_idx" ON "SearchPerformanceSnapshot"("organisationId");

-- CreateIndex
CREATE INDEX "SearchPerformanceSnapshot_capturedAt_idx" ON "SearchPerformanceSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_analyticsPropertyId_idx" ON "AnalyticsSnapshot"("analyticsPropertyId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_organisationId_idx" ON "AnalyticsSnapshot"("organisationId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_capturedAt_idx" ON "AnalyticsSnapshot"("capturedAt");

-- AddForeignKey
ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSource" ADD CONSTRAINT "BusinessSource_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSource" ADD CONSTRAINT "BusinessSource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchConsoleProperty" ADD CONSTRAINT "SearchConsoleProperty_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchConsoleProperty" ADD CONSTRAINT "SearchConsoleProperty_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsProperty" ADD CONSTRAINT "AnalyticsProperty_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsProperty" ADD CONSTRAINT "AnalyticsProperty_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GBPFieldAudit" ADD CONSTRAINT "GBPFieldAudit_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GBPFieldAudit" ADD CONSTRAINT "GBPFieldAudit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GBPFieldAudit" ADD CONSTRAINT "GBPFieldAudit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformanceSnapshot" ADD CONSTRAINT "SearchPerformanceSnapshot_searchConsolePropertyId_fkey" FOREIGN KEY ("searchConsolePropertyId") REFERENCES "SearchConsoleProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformanceSnapshot" ADD CONSTRAINT "SearchPerformanceSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformanceSnapshot" ADD CONSTRAINT "SearchPerformanceSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_analyticsPropertyId_fkey" FOREIGN KEY ("analyticsPropertyId") REFERENCES "AnalyticsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
