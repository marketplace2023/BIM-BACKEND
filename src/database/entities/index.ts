// ── Core ──────────────────────────────────────────────────
export { Tenant } from './core/tenant.entity';

// ── Identity ─────────────────────────────────────────────
export { ResPartner } from './identity/res-partner.entity';
export { ResUser } from './identity/res-user.entity';
export { UserRole } from './identity/user-role.entity';
export { UserRoleAssignment } from './identity/user-role-assignment.entity';

// ── Catalog ──────────────────────────────────────────────
export { ProductPublicCategory } from './catalog/product-public-category.entity';
export { ProductTemplate } from './catalog/product-template.entity';
export { ProductProduct } from './catalog/product-product.entity';
export { WebsiteFilter } from './catalog/website-filter.entity';

// ── Commerce ─────────────────────────────────────────────
export { SaleOrder } from './commerce/sale-order.entity';
export { SaleOrderLine } from './commerce/sale-order-line.entity';
export { CommerceIntent } from './commerce/commerce-intent.entity';
export { CommerceIntentItem } from './commerce/commerce-intent-item.entity';

// ── Payments ─────────────────────────────────────────────
export { PaymentTransaction } from './payments/payment-transaction.entity';
export { MarketplacePlan } from './payments/marketplace-plan.entity';
export { PartnerListingSubscription } from './payments/partner-listing-subscription.entity';
export { PartnerListingPayment } from './payments/partner-listing-payment.entity';
export { StorePaymentMethod } from './payments/store-payment-method.entity';

// ── Inventory ────────────────────────────────────────────
export { StockQuant } from './inventory/stock-quant.entity';

// ── Reputation ───────────────────────────────────────────
export { RatingRating } from './reputation/rating-rating.entity';

// ── Verticals — Partner profiles ─────────────────────────
export { ContractorProfile } from './verticals/contractor-profile.entity';
export { HardwareStoreProfile } from './verticals/hardware-store-profile.entity';
export { EducationProviderProfile } from './verticals/education-provider-profile.entity';
export { ProfessionalFirmProfile } from './verticals/professional-firm-profile.entity';
export { SeoAgencyProfile } from './verticals/seo-agency-profile.entity';

// ── Verticals — Product extensions ───────────────────────
export { HardwareProduct } from './verticals/hardware-product.entity';
export { ContractorService } from './verticals/contractor-service.entity';
export { Course } from './verticals/course.entity';
export { ProfessionalService } from './verticals/professional-service.entity';
export { SeoService } from './verticals/seo-service.entity';

// ── BIM ──────────────────────────────────────────────────
export { BimObra } from './bim/bim-obra.entity';
export { BimContratista } from './bim/bim-contratista.entity';
export { BimObraContratista } from './bim/bim-obra-contratista.entity';
export { BimPresupuesto } from './bim/bim-presupuesto.entity';
export { BimCapitulo } from './bim/bim-capitulo.entity';
export { BimPrecioUnitario } from './bim/bim-precio-unitario.entity';
export { BimRecurso } from './bim/bim-recurso.entity';
export { BimApuDescomposicion } from './bim/bim-apu-descomposicion.entity';
export { BimPartida } from './bim/bim-partida.entity';
export { BimPartidaMaterial } from './bim/bim-partida-material.entity';
export { BimComputo } from './bim/bim-computo.entity';
export { BimMedicion } from './bim/bim-medicion.entity';
export { BimReconsideracion } from './bim/bim-reconsideracion.entity';
export { BimCertificacion } from './bim/bim-certificacion.entity';
export { BimLineaCertificacion } from './bim/bim-linea-certificacion.entity';
export { BimObraProducto } from './bim/bim-obra-producto.entity';
