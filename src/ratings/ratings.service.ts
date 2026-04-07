import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { RatingRating } from '../database/entities/reputation/rating-rating.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ReplyRatingDto } from './dto/reply-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(RatingRating) private repo: Repository<RatingRating>,
    @InjectRepository(ProductTemplate)
    private productsRepo: Repository<ProductTemplate>,
    @InjectRepository(ResPartner)
    private partnersRepo: Repository<ResPartner>,
  ) {}

  private async resolveManagedPartnerId(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
  ) {
    if (!requestedPartnerId || requestedPartnerId === user.partner_id) {
      return user.partner_id;
    }

    const partner = await this.partnersRepo.findOne({
      where: {
        id: requestedPartnerId,
        tenant_id: user.tenant_id,
      },
    });

    if (!partner) {
      throw new NotFoundException('Managed store not found');
    }

    const basePartner = await this.partnersRepo.findOne({
      where: {
        id: user.partner_id,
        tenant_id: user.tenant_id,
      },
    });

    const effectiveEmail =
      user.email?.trim().toLowerCase() ??
      basePartner?.email?.trim().toLowerCase() ??
      null;

    const sameEmail =
      Boolean(effectiveEmail) &&
      Boolean(partner.email) &&
      partner.email!.trim().toLowerCase() === effectiveEmail;

    if (!sameEmail) {
      throw new ForbiddenException('Not allowed for this managed store');
    }

    return partner.id;
  }

  private async syncProductRatingAverage(productId?: string | null) {
    if (!productId) return;

    const ratings = await this.repo.find({
      where: { product_tmpl_id: productId, status: 'published' },
      select: ['rating'],
    });

    const average = ratings.length
      ? ratings.reduce((sum, item) => sum + Number(item.rating), 0) / ratings.length
      : 0;

    await this.productsRepo.update(productId, {
      rating_avg: average.toFixed(2),
    });
  }

  async create(tenantId: string, userId: string, dto: CreateRatingDto) {
    let product: ProductTemplate | null = null;
    if (dto.product_tmpl_id) {
      product = await this.productsRepo.findOne({ where: { id: dto.product_tmpl_id } });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    const entity = this.repo.create();
    entity.tenant_id = tenantId;
    entity.reviewer_user_id = userId;
    entity.partner_id = dto.partner_id ?? product?.partner_id ?? null;
    entity.product_tmpl_id = dto.product_tmpl_id ?? null;
    entity.order_id = dto.order_id ?? null;
    entity.rating = String(dto.rating);
    entity.title = dto.title ?? null;
    entity.comment = dto.comment ?? null;
    entity.status = 'published';
    entity.replier_user_id = null;
    entity.reply_comment = null;
    entity.reply_created_at = null;
    const saved = await this.repo.save(entity);

    await this.syncProductRatingAverage(saved.product_tmpl_id);

    return saved;
  }

  async findAll(filters: {
    partner_id?: string;
    product_tmpl_id?: string;
    reviewer_user_id?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 10);
    const qb = this.repo
      .createQueryBuilder('rating')
      .leftJoin('rating.reviewer', 'reviewer')
      .leftJoin('rating.replier', 'replier')
      .leftJoin('rating.product_template', 'product')
      .leftJoin('rating.partner', 'partner')
      .where('rating.status = :status', { status: 'published' })
      .orderBy('rating.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'rating.id AS id',
        'rating.reviewer_user_id AS reviewer_user_id',
        'rating.partner_id AS partner_id',
        'rating.product_tmpl_id AS product_tmpl_id',
        'rating.order_id AS order_id',
        'rating.rating AS rating',
        'rating.title AS title',
        'rating.comment AS comment',
        'rating.status AS status',
        'rating.reply_comment AS reply_comment',
        'rating.reply_created_at AS reply_created_at',
        'rating.replier_user_id AS replier_user_id',
        'rating.created_at AS created_at',
        'reviewer.id AS reviewer_id',
        'reviewer.username AS reviewer_username',
        'replier.id AS replier_id',
        'replier.username AS replier_username',
        'product.name AS product_name',
        'product.vertical_type AS product_vertical_type',
        'partner.name AS partner_name',
      ]);

    if (filters.partner_id) {
      qb.andWhere('rating.partner_id = :partnerId', { partnerId: filters.partner_id });
    }

    if (filters.product_tmpl_id) {
      qb.andWhere('rating.product_tmpl_id = :productId', {
        productId: filters.product_tmpl_id,
      });
    }

    if (filters.reviewer_user_id) {
      qb.andWhere('rating.reviewer_user_id = :reviewerUserId', {
        reviewerUserId: filters.reviewer_user_id,
      });
    }

    const countQb = this.repo.createQueryBuilder('rating').where('rating.status = :status', {
      status: 'published',
    });

    if (filters.partner_id) {
      countQb.andWhere('rating.partner_id = :partnerId', { partnerId: filters.partner_id });
    }

    if (filters.product_tmpl_id) {
      countQb.andWhere('rating.product_tmpl_id = :productId', {
        productId: filters.product_tmpl_id,
      });
    }

    if (filters.reviewer_user_id) {
      countQb.andWhere('rating.reviewer_user_id = :reviewerUserId', {
        reviewerUserId: filters.reviewer_user_id,
      });
    }

    const [rows, total] = await Promise.all([qb.getRawMany(), countQb.getCount()]);

    return {
      data: rows.map((row) => ({
        id: String(row.id),
        reviewer_user_id: String(row.reviewer_user_id),
        partner_id: row.partner_id ? String(row.partner_id) : null,
        product_tmpl_id: row.product_tmpl_id ? String(row.product_tmpl_id) : null,
        order_id: row.order_id ? String(row.order_id) : null,
        rating: String(row.rating),
        title: row.title ? String(row.title) : null,
        comment: row.comment ? String(row.comment) : null,
        status: String(row.status),
        reply_comment: row.reply_comment ? String(row.reply_comment) : null,
        reply_created_at: row.reply_created_at ?? null,
        replier_user_id: row.replier_user_id ? String(row.replier_user_id) : null,
        created_at: row.created_at,
        product_name: row.product_name ? String(row.product_name) : null,
        product_vertical_type: row.product_vertical_type
          ? String(row.product_vertical_type)
          : null,
        partner_name: row.partner_name ? String(row.partner_name) : null,
        reviewer: row.reviewer_id
          ? {
              id: String(row.reviewer_id),
              username: row.reviewer_username ? String(row.reviewer_username) : 'Usuario',
            }
          : null,
        replier: row.replier_id
          ? {
              id: String(row.replier_id),
              username: row.replier_username ? String(row.replier_username) : 'Tienda',
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async reply(
    id: string,
    user: { id: string; tenant_id: string; partner_id: string; email?: string },
    dto: ReplyRatingDto,
    requestedPartnerId?: string,
  ) {
    const rating = await this.repo.findOne({ where: { id } });
    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    const managedPartnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);
    const targetPartnerId = rating.partner_id;

    if (!targetPartnerId || targetPartnerId !== managedPartnerId) {
      throw new ForbiddenException('Not allowed to reply to this rating');
    }

    rating.replier_user_id = user.id;
    rating.reply_comment = dto.comment.trim();
    rating.reply_created_at = new Date();

    return this.repo.save(rating);
  }

  async remove(id: string, userId: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Rating not found');
    if (r.reviewer_user_id !== userId)
      throw new ForbiddenException('Not your rating');
    await this.repo.delete(id);

    await this.syncProductRatingAverage(r.product_tmpl_id);

    return { message: 'Rating deleted' };
  }
}
