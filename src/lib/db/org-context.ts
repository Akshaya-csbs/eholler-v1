import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/security/encryption';
import {
  OrgRole,
  BusinessStatus,
  SourceType,
  ConnectionStatus,
  AuditStatus,
  GBPFieldStatus,
  RecommendationCategory,
  SeverityLevel,
  EffortLevel,
} from '@prisma/client';

/**
 * Organisation-Level Data Isolation Layer.
 * Ensures all tenant queries are strictly scoped to the organisationId,
 * preventing cross-organisation data access or leakage.
 */

export interface CreateBusinessInput {
  name: string;
  slug?: string;
  placeId?: string;
  formattedAddress?: string;
  city?: string;
  category?: string;
  phone?: string;
  websiteUrl?: string;
  mapUrl?: string;
  rating?: number;
  reviewCount?: number;
}

export interface SaveAuditRunInput {
  businessId: string;
  triggeredByUserId?: string;
  authorityScore?: number;
  mapsRank?: number;
  gbpHealthScore?: number;
  completenessScore?: number;
  missingFieldsCount?: number;
  inconsistentFieldsCount?: number;
  summary?: string;
  errorMessage?: string;
  status: AuditStatus;
  startedAt?: Date;
  completedAt?: Date;
  fieldAudits?: Array<{
    fieldId: string;
    fieldName: string;
    category: string;
    status: GBPFieldStatus;
    currentValue?: string;
    recommendedContent?: string;
    whyItMatters?: string;
    action?: string;
    confidence?: string;
    applicable?: boolean;
    verifiable?: boolean;
  }>;
  aiRecommendations?: Array<{
    issueTitle: string;
    category: RecommendationCategory;
    evidence: string;
    severity: SeverityLevel;
    explanation: string;
    recommendedAction: string;
    suggestedContent?: string;
    estimatedEffort: EffortLevel;
  }>;
  sourceSnapshots?: Array<{
    sourceType: SourceType;
    rawData: any;
    metadata?: any;
  }>;
}

export interface CompleteAuditRunInput {
  authorityScore?: number;
  mapsRank?: number;
  gbpHealthScore?: number;
  completenessScore?: number;
  missingFieldsCount?: number;
  inconsistentFieldsCount?: number;
  summary?: string;
  fieldAudits?: Array<{
    fieldId: string;
    fieldName: string;
    category: string;
    status: GBPFieldStatus;
    currentValue?: string;
    recommendedContent?: string;
    whyItMatters?: string;
    action?: string;
    confidence?: string;
    applicable?: boolean;
    verifiable?: boolean;
  }>;
  aiRecommendations?: Array<{
    issueTitle: string;
    category: RecommendationCategory;
    evidence: string;
    severity: SeverityLevel;
    explanation: string;
    recommendedAction: string;
    suggestedContent?: string;
    estimatedEffort: EffortLevel;
  }>;
  sourceSnapshots?: Array<{
    sourceType: SourceType;
    rawData: any;
    metadata?: any;
  }>;
}

export type OrgScope = ReturnType<typeof createOrgScope>;

export function createOrgScope(organisationId: string) {
  if (!organisationId || typeof organisationId !== 'string') {
    throw new Error('organisationId is required to enforce data isolation.');
  }

  return {
    organisationId,

    // ── Businesses ───────────────────────────────────────────────────────────
    async listBusinesses() {
      return prisma.business.findMany({
        where: { organisationId, status: BusinessStatus.ACTIVE },
        orderBy: { updatedAt: 'desc' },
      });
    },

    async getBusinessById(businessId: string) {
      return prisma.business.findFirst({
        where: { id: businessId, organisationId },
      });
    },

    async getBusinessByPlaceId(placeId: string) {
      return prisma.business.findFirst({
        where: { placeId, organisationId },
      });
    },

    async upsertBusiness(input: CreateBusinessInput) {
      if (input.placeId) {
        const existing = await prisma.business.findFirst({
          where: { placeId: input.placeId, organisationId },
        });

        if (existing) {
          return prisma.business.update({
            where: { id: existing.id },
            data: {
              name: input.name,
              formattedAddress: input.formattedAddress,
              city: input.city,
              category: input.category,
              phone: input.phone,
              websiteUrl: input.websiteUrl,
              mapUrl: input.mapUrl,
              rating: input.rating,
              reviewCount: input.reviewCount,
              updatedAt: new Date(),
            },
          });
        }
      }

      return prisma.business.create({
        data: {
          organisationId,
          name: input.name,
          slug: input.slug,
          placeId: input.placeId,
          formattedAddress: input.formattedAddress,
          city: input.city,
          category: input.category,
          phone: input.phone,
          websiteUrl: input.websiteUrl,
          mapUrl: input.mapUrl,
          rating: input.rating,
          reviewCount: input.reviewCount,
          status: BusinessStatus.ACTIVE,
        },
      });
    },

    // ── Audit Runs ───────────────────────────────────────────────────────────
    async listAuditRuns(businessId?: string, limit = 20) {
      return prisma.auditRun.findMany({
        where: {
          organisationId,
          ...(businessId ? { businessId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          business: { select: { name: true, city: true, category: true } },
        },
      });
    },

    async getAuditRunById(auditRunId: string) {
      return prisma.auditRun.findFirst({
        where: { id: auditRunId, organisationId },
        include: {
          business: true,
          fieldAudits: true,
          aiRecommendations: true,
          snapshots: true,
        },
      });
    },

    async startAuditRun(businessId: string, triggeredByUserId?: string) {
      const business = await prisma.business.findFirst({
        where: { id: businessId, organisationId },
      });
      if (!business) {
        throw new Error('Business does not belong to this organisation.');
      }

      return prisma.auditRun.create({
        data: {
          organisationId,
          businessId,
          status: AuditStatus.RUNNING,
          startedAt: new Date(),
          triggeredByUserId,
        },
      });
    },

    async saveSourceSnapshot(
      auditRunId: string,
      businessId: string,
      sourceType: SourceType,
      rawData: any,
      metadata?: any
    ) {
      const audit = await prisma.auditRun.findFirst({
        where: { id: auditRunId, organisationId, businessId },
      });
      if (!audit) {
        throw new Error('AuditRun not found or does not belong to this organisation.');
      }

      return prisma.sourceSnapshot.create({
        data: {
          organisationId,
          businessId,
          auditRunId,
          sourceType,
          rawData: typeof rawData === 'object' && rawData !== null ? rawData : { data: rawData },
          metadata: metadata || undefined,
        },
      });
    },

    async completeAuditRun(auditRunId: string, data: CompleteAuditRunInput) {
      const existingAudit = await prisma.auditRun.findFirst({
        where: { id: auditRunId, organisationId },
      });
      if (!existingAudit) {
        throw new Error('AuditRun not found or does not belong to this organisation.');
      }

      const businessId = existingAudit.businessId;

      return prisma.$transaction(async (tx) => {
        // Save field audits if provided
        if (data.fieldAudits && data.fieldAudits.length > 0) {
          await tx.gBPFieldAudit.createMany({
            data: data.fieldAudits.map((f) => ({
              auditRunId,
              organisationId,
              businessId,
              fieldId: f.fieldId,
              fieldName: f.fieldName,
              category: f.category,
              status: f.status,
              currentValue: f.currentValue,
              recommendedContent: f.recommendedContent,
              whyItMatters: f.whyItMatters,
              action: f.action,
              confidence: f.confidence,
              applicable: f.applicable ?? true,
              verifiable: f.verifiable ?? true,
            })),
          });
        }

        // Save AI recommendations if provided (with DRAFT status)
        if (data.aiRecommendations && data.aiRecommendations.length > 0) {
          await tx.aIRecommendation.createMany({
            data: data.aiRecommendations.map((r) => ({
              auditRunId,
              organisationId,
              businessId,
              issueTitle: r.issueTitle,
              category: r.category,
              evidence: r.evidence,
              severity: r.severity,
              explanation: r.explanation,
              recommendedAction: r.recommendedAction,
              suggestedContent: r.suggestedContent,
              estimatedEffort: r.estimatedEffort,
              status: 'DRAFT',
            })),
          });
        }

        // Save any additional source snapshots if provided
        if (data.sourceSnapshots && data.sourceSnapshots.length > 0) {
          await tx.sourceSnapshot.createMany({
            data: data.sourceSnapshots.map((s) => ({
              auditRunId,
              organisationId,
              businessId,
              sourceType: s.sourceType,
              rawData: typeof s.rawData === 'object' && s.rawData !== null ? s.rawData : { data: s.rawData },
              metadata: s.metadata || undefined,
            })),
          });
        }

        // Update the audit run itself to COMPLETED
        return tx.auditRun.update({
          where: { id: auditRunId },
          data: {
            status: AuditStatus.COMPLETED,
            completedAt: new Date(),
            authorityScore: data.authorityScore,
            mapsRank: data.mapsRank,
            gbpHealthScore: data.gbpHealthScore,
            completenessScore: data.completenessScore,
            missingFieldsCount: data.missingFieldsCount,
            inconsistentFieldsCount: data.inconsistentFieldsCount,
            summary: data.summary,
          },
          include: {
            business: true,
            fieldAudits: true,
            aiRecommendations: true,
            snapshots: true,
          },
        });
      });
    },

    async failAuditRun(auditRunId: string, errorMessage: string) {
      const existingAudit = await prisma.auditRun.findFirst({
        where: { id: auditRunId, organisationId },
      });
      if (!existingAudit) return null;

      return prisma.auditRun.update({
        where: { id: auditRunId },
        data: {
          status: AuditStatus.FAILED,
          completedAt: new Date(),
          errorMessage,
        },
      });
    },

    async getLatestCompletedAudit(businessId?: string) {
      return prisma.auditRun.findFirst({
        where: {
          organisationId,
          status: AuditStatus.COMPLETED,
          ...(businessId ? { businessId } : {}),
        },
        orderBy: { completedAt: 'desc' },
        include: {
          business: true,
          fieldAudits: true,
          aiRecommendations: true,
          snapshots: true,
        },
      });
    },

    async saveAuditRun(input: SaveAuditRunInput) {
      // Validate business ownership
      const business = await prisma.business.findFirst({
        where: { id: input.businessId, organisationId },
      });
      if (!business) {
        throw new Error('Business does not belong to this organisation.');
      }

      return prisma.auditRun.create({
        data: {
          organisationId,
          businessId: input.businessId,
          status: input.status,
          triggeredByUserId: input.triggeredByUserId,
          authorityScore: input.authorityScore,
          mapsRank: input.mapsRank,
          gbpHealthScore: input.gbpHealthScore,
          completenessScore: input.completenessScore,
          missingFieldsCount: input.missingFieldsCount,
          inconsistentFieldsCount: input.inconsistentFieldsCount,
          summary: input.summary,
          errorMessage: input.errorMessage,
          startedAt: input.startedAt ?? new Date(),
          completedAt: input.completedAt,
          fieldAudits: input.fieldAudits
            ? {
                create: input.fieldAudits.map((f) => ({
                  organisationId,
                  businessId: input.businessId,
                  fieldId: f.fieldId,
                  fieldName: f.fieldName,
                  category: f.category,
                  status: f.status,
                  currentValue: f.currentValue,
                  recommendedContent: f.recommendedContent,
                  whyItMatters: f.whyItMatters,
                  action: f.action,
                  confidence: f.confidence,
                  applicable: f.applicable ?? true,
                  verifiable: f.verifiable ?? true,
                })),
              }
            : undefined,
          aiRecommendations: input.aiRecommendations
            ? {
                create: input.aiRecommendations.map((r) => ({
                  organisationId,
                  businessId: input.businessId,
                  issueTitle: r.issueTitle,
                  category: r.category,
                  evidence: r.evidence,
                  severity: r.severity,
                  explanation: r.explanation,
                  recommendedAction: r.recommendedAction,
                  suggestedContent: r.suggestedContent,
                  estimatedEffort: r.estimatedEffort,
                })),
              }
            : undefined,
          snapshots: input.sourceSnapshots
            ? {
                create: input.sourceSnapshots.map((s) => ({
                  organisationId,
                  businessId: input.businessId,
                  sourceType: s.sourceType,
                  rawData: s.rawData,
                  metadata: s.metadata,
                })),
              }
            : undefined,
        },
      });
    },

    // ── Google Connection & Encrypted Token Management ──────────────────────
    async getGoogleConnection() {
      const conn = await prisma.googleConnection.findFirst({
        where: { organisationId, status: ConnectionStatus.CONNECTED },
        include: { scProperties: true, gaProperties: true },
      });

      if (!conn) return null;

      return {
        ...conn,
        accessToken: decryptToken(conn.encryptedAccessToken),
        refreshToken: conn.encryptedRefreshToken ? decryptToken(conn.encryptedRefreshToken) : null,
      };
    },

    async saveGoogleConnection(params: {
      email: string;
      accessToken: string;
      refreshToken?: string;
      tokenExpiry?: Date;
      scopes: string[];
      googleUserId?: string;
    }) {
      const encryptedAccessToken = encryptToken(params.accessToken);
      const encryptedRefreshToken = params.refreshToken ? encryptToken(params.refreshToken) : undefined;

      return prisma.googleConnection.upsert({
        where: {
          organisationId_email: {
            organisationId,
            email: params.email,
          },
        },
        create: {
          organisationId,
          email: params.email,
          googleUserId: params.googleUserId,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiry: params.tokenExpiry,
          scopes: params.scopes,
          status: ConnectionStatus.CONNECTED,
        },
        update: {
          encryptedAccessToken,
          ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
          tokenExpiry: params.tokenExpiry,
          scopes: params.scopes,
          status: ConnectionStatus.CONNECTED,
          updatedAt: new Date(),
        },
      });
    },

    async disconnectGoogle() {
      return prisma.googleConnection.updateMany({
        where: { organisationId },
        data: { status: ConnectionStatus.REVOKED },
      });
    },

    // ── Search Console Properties ───────────────────────────────────────────
    async listSearchConsoleProperties() {
      return prisma.searchConsoleProperty.findMany({
        where: { organisationId },
        orderBy: { siteUrl: 'asc' },
      });
    },

    async selectSearchConsoleProperty(propertyId: string) {
      await prisma.$transaction([
        prisma.searchConsoleProperty.updateMany({
          where: { organisationId },
          data: { isSelected: false },
        }),
        prisma.searchConsoleProperty.updateMany({
          where: { id: propertyId, organisationId },
          data: { isSelected: true },
        }),
      ]);
    },
  };
}

export default createOrgScope;
