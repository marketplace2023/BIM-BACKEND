import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { CommerceIntent } from '../database/entities/commerce/commerce-intent.entity';
import { Course } from '../database/entities/verticals/course.entity';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { RatingRating } from '../database/entities/reputation/rating-rating.entity';
import { mapLegacyStatusToFurStatus } from '../common/constants/marketplace.constants';

const SELLER_ENTITY_TYPES = [
  'hardware_store',
  'contractor',
  'education_provider',
  'professional_firm',
  'seo_agency',
] as const;

function resolveUserFurStatus(user: ResUser) {
  const security = user.security_json ?? {};
  return security.fur_u?.status ?? mapLegacyStatusToFurStatus(user.kyc_status);
}

function resolveStoreFurStatus(partner: ResPartner) {
  const attrs = partner.attributes_json ?? {};
  return (
    attrs.fur_t?.status ??
    mapLegacyStatusToFurStatus(partner.x_verification_status)
  );
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ResPartner)
    private readonly partnersRepo: Repository<ResPartner>,
    @InjectRepository(ResUser)
    private readonly usersRepo: Repository<ResUser>,
    @InjectRepository(ProductTemplate)
    private readonly productsRepo: Repository<ProductTemplate>,
    @InjectRepository(CommerceIntent)
    private readonly intentsRepo: Repository<CommerceIntent>,
    @InjectRepository(Course)
    private readonly coursesRepo: Repository<Course>,
    @InjectRepository(SaleOrder)
    private readonly ordersRepo: Repository<SaleOrder>,
    @InjectRepository(RatingRating)
    private readonly ratingsRepo: Repository<RatingRating>,
  ) {}

  private async syncProductRatingAverage(productId?: string | null) {
    if (!productId) return;

    const ratings = await this.ratingsRepo.find({
      where: { product_tmpl_id: productId, status: 'published' },
      select: ['rating'],
    });

    const average = ratings.length
      ? ratings.reduce((sum, item) => sum + Number(item.rating), 0) /
        ratings.length
      : 0;

    await this.productsRepo.update(productId, {
      rating_avg: average.toFixed(2),
    });
  }

  async getDashboard(tenantId: string) {
    const [
      storesRegistered,
      coursesRegistered,
      contractsCompleted,
      productsCreated,
    ] = await Promise.all([
      this.partnersRepo.count({
        where: {
          tenant_id: tenantId,
          entity_type: In([...SELLER_ENTITY_TYPES]),
          deleted_at: IsNull(),
        },
      }),
      this.coursesRepo
        .createQueryBuilder('course')
        .innerJoin('course.product_template', 'product')
        .where('product.tenant_id = :tenantId', { tenantId })
        .andWhere('product.deleted_at IS NULL')
        .getCount(),
      this.ordersRepo.count({
        where: {
          tenant_id: tenantId,
          status: Not('draft'),
        },
      }),
      this.productsRepo.count({
        where: {
          tenant_id: tenantId,
          listing_type: 'product',
          deleted_at: IsNull(),
        },
      }),
    ]);

    const [recentStores, recentContracts] = await Promise.all([
      this.partnersRepo.find({
        where: {
          tenant_id: tenantId,
          entity_type: In([...SELLER_ENTITY_TYPES]),
          deleted_at: IsNull(),
        },
        order: { created_at: 'DESC' },
        take: 5,
      }),
      this.ordersRepo.find({
        where: {
          tenant_id: tenantId,
          status: Not('draft'),
        },
        order: { created_at: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      metrics: {
        stores_registered: storesRegistered,
        courses_registered: coursesRegistered,
        contracts_completed: contractsCompleted,
        products_created: productsCreated,
      },
      recent_stores: recentStores.map((store) => ({
        id: store.id,
        name: store.name,
        entity_type: store.entity_type,
        city: store.city,
        email: store.email,
        created_at: store.created_at,
      })),
      recent_contracts: recentContracts.map((contract) => ({
        id: contract.id,
        order_number: contract.order_number,
        status: contract.status,
        amount_total: contract.amount_total,
        created_at: contract.created_at,
      })),
    };
  }

  async getUsers(tenantId: string) {
    const [consumers, storePartners] = await Promise.all([
      this.usersRepo
        .createQueryBuilder('user')
        .innerJoinAndSelect('user.partner', 'partner')
        .where('user.tenant_id = :tenantId', { tenantId })
        .andWhere('partner.entity_type = :entityType', {
          entityType: 'customer',
        })
        .andWhere('partner.deleted_at IS NULL')
        .andWhere(
          '(partner.x_partner_role IS NULL OR partner.x_partner_role != :adminRole)',
          {
            adminRole: 'admin',
          },
        )
        .orderBy('user.created_at', 'DESC')
        .getMany(),
      this.partnersRepo.find({
        where: {
          tenant_id: tenantId,
          entity_type: In([...SELLER_ENTITY_TYPES]),
          deleted_at: IsNull(),
        },
        order: { created_at: 'DESC' },
      }),
    ]);

    const storeEmails = Array.from(
      new Set(
        storePartners
          .map((partner) => partner.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    );

    const ownerUsers =
      storeEmails.length > 0
        ? await this.usersRepo.find({
            where: {
              tenant_id: tenantId,
              email: In(storeEmails),
            },
            relations: ['partner'],
          })
        : [];

    const ownerByEmail = new Map(
      ownerUsers.map((user) => [user.email.trim().toLowerCase(), user]),
    );

    return {
      consumers: consumers.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        is_active: user.is_active,
        fur_user_status: resolveUserFurStatus(user),
        created_at: user.created_at,
        partner: {
          id: user.partner.id,
          name: user.partner.name,
          city: user.partner.city,
          country: user.partner.country,
          entity_type: user.partner.entity_type,
        },
      })),
      stores: storePartners.map((partner) => {
        const owner = partner.email
          ? ownerByEmail.get(partner.email.trim().toLowerCase())
          : null;

        return {
          id: partner.id,
          user_id: owner?.id ?? null,
          email: partner.email ?? owner?.email ?? '',
          username:
            owner?.username ?? partner.email?.split('@')[0] ?? partner.name,
          is_active: owner?.is_active ?? 1,
          fur_user_status: owner ? resolveUserFurStatus(owner) : undefined,
          created_at: partner.created_at,
          partner: {
            id: partner.id,
            name: partner.name,
            city: partner.city,
            country: partner.country,
            entity_type: partner.entity_type,
            verification_status: partner.x_verification_status,
            fur_store_status: resolveStoreFurStatus(partner),
          },
        };
      }),
    };
  }

  async getRatings(
    tenantId: string,
    filters: { status?: string; page?: number; limit?: number },
  ) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);

    const qb = this.ratingsRepo
      .createQueryBuilder('rating')
      .innerJoin('rating.tenant', 'tenant')
      .leftJoin('rating.reviewer', 'reviewer')
      .leftJoin('rating.replier', 'replier')
      .leftJoin('rating.product_template', 'product')
      .leftJoin('rating.partner', 'partner')
      .where('tenant.id = :tenantId', { tenantId })
      .orderBy('rating.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'rating.id AS id',
        'rating.rating AS rating',
        'rating.title AS title',
        'rating.comment AS comment',
        'rating.status AS status',
        'rating.created_at AS created_at',
        'rating.reply_comment AS reply_comment',
        'rating.reply_created_at AS reply_created_at',
        'reviewer.id AS reviewer_id',
        'reviewer.username AS reviewer_username',
        'reviewer.email AS reviewer_email',
        'replier.id AS replier_id',
        'replier.username AS replier_username',
        'product.id AS product_id',
        'product.name AS product_name',
        'product.vertical_type AS product_vertical_type',
        'partner.id AS partner_id',
        'partner.name AS partner_name',
        'partner.entity_type AS partner_entity_type',
      ]);

    if (filters.status && filters.status !== 'all') {
      qb.andWhere('rating.status = :status', { status: filters.status });
    }

    const countQb = this.ratingsRepo
      .createQueryBuilder('rating')
      .innerJoin('rating.tenant', 'tenant')
      .where('tenant.id = :tenantId', { tenantId });

    if (filters.status && filters.status !== 'all') {
      countQb.andWhere('rating.status = :status', { status: filters.status });
    }

    const [rows, total] = await Promise.all([
      qb.getRawMany(),
      countQb.getCount(),
    ]);

    return {
      data: rows.map((row) => ({
        id: String(row.id),
        rating: String(row.rating),
        title: row.title ? String(row.title) : null,
        comment: row.comment ? String(row.comment) : null,
        status: String(row.status),
        created_at: row.created_at,
        reply_comment: row.reply_comment ? String(row.reply_comment) : null,
        reply_created_at: row.reply_created_at ?? null,
        reviewer: row.reviewer_id
          ? {
              id: String(row.reviewer_id),
              username: row.reviewer_username
                ? String(row.reviewer_username)
                : 'Usuario',
              email: row.reviewer_email ? String(row.reviewer_email) : null,
            }
          : null,
        replier: row.replier_id
          ? {
              id: String(row.replier_id),
              username: row.replier_username
                ? String(row.replier_username)
                : 'Tienda',
            }
          : null,
        product: row.product_id
          ? {
              id: String(row.product_id),
              name: row.product_name ? String(row.product_name) : 'Item',
              vertical_type: row.product_vertical_type
                ? String(row.product_vertical_type)
                : null,
            }
          : null,
        partner: row.partner_id
          ? {
              id: String(row.partner_id),
              name: row.partner_name ? String(row.partner_name) : 'Tienda',
              entity_type: row.partner_entity_type
                ? String(row.partner_entity_type)
                : null,
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async updateRatingStatus(tenantId: string, ratingId: string, status: string) {
    const rating = await this.ratingsRepo.findOne({
      where: { id: ratingId, tenant_id: tenantId },
    });

    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    rating.status = status;
    const saved = await this.ratingsRepo.save(rating);
    await this.syncProductRatingAverage(saved.product_tmpl_id);
    return saved;
  }

  async getCommercialPayments(
    tenantId: string,
    filters: { payment_status?: string; page?: number; limit?: number },
  ) {
    const orderWhere: Record<string, any> = { tenant_id: tenantId };
    const intentWhere: Record<string, any> = { tenant_id: tenantId };

    if (filters.payment_status && filters.payment_status !== 'all') {
      orderWhere.payment_status = filters.payment_status;
      intentWhere.payment_status = filters.payment_status;
    }

    const [orders, intents] = await Promise.all([
      this.ordersRepo.find({
        where: orderWhere,
        relations: ['partner', 'professional', 'payment_method'],
        order: { created_at: 'DESC' },
        take: Number(filters.limit ?? 50),
      }),
      this.intentsRepo.find({
        where: intentWhere,
        relations: ['buyer_partner', 'store_partner', 'payment_method'],
        order: { created_at: 'DESC' },
        take: Number(filters.limit ?? 50),
      }),
    ]);

    const data = [
      ...orders.map((order) => ({
        source: 'order',
        id: order.id,
        reference: order.order_number,
        vertical_type: String(order.meta_json?.vertical_type ?? 'unknown'),
        amount: order.amount_total,
        currency_code: order.currency_code,
        payment_status: order.payment_status,
        payment_reference: order.payment_reference,
        payment_proof_url: order.payment_proof_url,
        payment_notes: order.payment_notes,
        created_at: order.created_at,
        buyer_name: order.partner?.name ?? 'Cliente',
        store_name: order.professional?.name ?? 'Tienda',
        payment_method_title: order.payment_method?.title ?? null,
      })),
      ...intents.map((intent) => ({
        source: 'intent',
        id: intent.id,
        reference: `INT-${intent.id}`,
        vertical_type: intent.vertical_type,
        amount: '0.00',
        currency_code: intent.currency_code,
        payment_status: intent.payment_status,
        payment_reference: intent.payment_reference,
        payment_proof_url: intent.payment_proof_url,
        payment_notes: intent.payment_notes,
        created_at: intent.created_at,
        buyer_name: intent.buyer_partner?.name ?? 'Cliente',
        store_name: intent.store_partner?.name ?? 'Tienda',
        payment_method_title: intent.payment_method?.title ?? null,
      })),
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      data,
      total: data.length,
      page: 1,
      limit: Number(filters.limit ?? 50),
    };
  }
}
