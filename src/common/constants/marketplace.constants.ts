export const MARKETPLACE_ROLES = ['consumer', 'store', 'admin'] as const;
export type MarketplaceRole = (typeof MARKETPLACE_ROLES)[number];

export const SELLER_ENTITY_TYPES = [
  'contractor',
  'education_provider',
  'hardware_store',
  'professional_firm',
  'seo_agency',
] as const;
export type SellerEntityType = (typeof SELLER_ENTITY_TYPES)[number];

export const ENTITY_TYPES = [...SELLER_ENTITY_TYPES, 'customer'] as const;
export type MarketplaceEntityType = (typeof ENTITY_TYPES)[number];

export const FUR_STATUSES = [
  'draft',
  'review',
  'published',
  'suspended',
] as const;
export type FurStatus = (typeof FUR_STATUSES)[number];

export function isSellerEntityType(value?: string): value is SellerEntityType {
  return SELLER_ENTITY_TYPES.includes(value as SellerEntityType);
}

export function mapLegacyStatusToFurStatus(value?: string | null): FurStatus {
  switch (value) {
    case 'review':
    case 'pending':
      return 'review';
    case 'published':
    case 'approved':
    case 'verified':
      return 'published';
    case 'suspended':
    case 'inactive':
      return 'suspended';
    case 'draft':
    default:
      return 'draft';
  }
}

export function mapFurStatusToLegacy(value: FurStatus): string {
  switch (value) {
    case 'review':
      return 'review';
    case 'published':
      return 'published';
    case 'suspended':
      return 'suspended';
    case 'draft':
    default:
      return 'draft';
  }
}
