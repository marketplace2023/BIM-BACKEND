import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ProductImage } from '../database/entities/catalog/product-image.entity';
import { ProductProduct } from '../database/entities/catalog/product-product.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { StockQuant } from '../database/entities/inventory/stock-quant.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ContractorService } from '../database/entities/verticals/contractor-service.entity';
import { Course } from '../database/entities/verticals/course.entity';
import { HardwareProduct } from '../database/entities/verticals/hardware-product.entity';
import { ProfessionalService } from '../database/entities/verticals/professional-service.entity';
import { SeoService } from '../database/entities/verticals/seo-service.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { uniqueSlug } from '../common/utils/slug.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductTemplate)
    private tmplRepo: Repository<ProductTemplate>,
    @InjectRepository(ProductImage)
    private imageRepo: Repository<ProductImage>,
    @InjectRepository(ProductProduct)
    private variantRepo: Repository<ProductProduct>,
    @InjectRepository(StockQuant)
    private stockQuantRepo: Repository<StockQuant>,
    @InjectRepository(ResPartner)
    private partnersRepo: Repository<ResPartner>,
    @InjectRepository(ContractorService)
    private contractorSvcRepo: Repository<ContractorService>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    @InjectRepository(HardwareProduct)
    private hardwareProductRepo: Repository<HardwareProduct>,
    @InjectRepository(ProfessionalService)
    private professionalSvcRepo: Repository<ProfessionalService>,
    @InjectRepository(SeoService) private seoSvcRepo: Repository<SeoService>,
  ) {}

  private async resolveManagedPartnerId(
    user: {
      tenant_id: string;
      partner_id: string;
      email?: string;
    },
    requestedPartnerId?: string,
  ) {
    if (!requestedPartnerId || requestedPartnerId === user.partner_id) {
      return user.partner_id;
    }

    const partner = await this.partnersRepo.findOne({
      where: {
        id: requestedPartnerId,
        tenant_id: user.tenant_id,
        deleted_at: IsNull(),
      },
    });

    if (!partner) {
      throw new NotFoundException('Managed store not found');
    }

    const basePartner = await this.partnersRepo.findOne({
      where: {
        id: user.partner_id,
        tenant_id: user.tenant_id,
        deleted_at: IsNull(),
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

  async create(
    user: { tenant_id: string; partner_id: string; email?: string },
    dto: CreateProductDto,
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const slug = uniqueSlug(dto.name);
    const tmpl = await this.tmplRepo.save(
      this.tmplRepo.create({
        tenant_id: user.tenant_id,
        partner_id: partnerId,
        categ_id: dto.categ_id ?? null,
        listing_type: dto.listing_type,
        vertical_type: dto.vertical_type,
        name: dto.name,
        slug,
        description_sale: dto.description_sale ?? null,
        list_price: String(dto.list_price),
        compare_price:
          dto.compare_price != null ? String(dto.compare_price) : null,
        currency_code: dto.currency_code ?? 'USD',
        type: dto.type ?? 'service',
        x_attributes_json: dto.x_attributes_json ?? null,
        seo_json: dto.seo_json ?? null,
        cta_json: dto.cta_json ?? null,
        cover_image_url: dto.cover_image_url ?? null,
        is_published: 0,
      }),
    );
    await this._ensureDefaultVariant(tmpl.id, user.tenant_id, partnerId, dto);
    await this._createExtension(tmpl.id, dto);
    await this._syncImagesFromAttributes(tmpl.id, dto);
    return this.findOne(tmpl.id);
  }

  private async _ensureDefaultVariant(
    tmplId: string,
    tenantId: string,
    partnerId: string,
    dto: CreateProductDto,
  ) {
    const skuCandidate =
      typeof dto.x_attributes_json?.sku === 'string' &&
      dto.x_attributes_json.sku.trim().length > 0
        ? dto.x_attributes_json.sku.trim()
        : `SKU-${tmplId}`;

    const variant = await this.variantRepo.save(
      this.variantRepo.create({
        product_tmpl_id: tmplId,
        sku: skuCandidate,
        barcode: null,
        variant_attributes_json: null,
        price_extra: '0',
        active: 1,
      }),
    );

    await this.tmplRepo.update(tmplId, {
      default_code: skuCandidate,
    });

    const initialStock = Number(dto.x_attributes_json?.stock ?? 0);
    const locationCode =
      typeof dto.x_attributes_json?.location_code === 'string'
        ? dto.x_attributes_json.location_code
        : 'Bodega principal';

    await this.stockQuantRepo.save(
      this.stockQuantRepo.create({
        tenant_id: tenantId,
        partner_id: partnerId,
        product_variant_id: variant.id,
        location_code: locationCode,
        quantity: String(initialStock),
        reserved_quantity: '0',
      }),
    );
  }

  private async _syncImagesFromAttributes(
    productId: string,
    dto: Pick<
      CreateProductDto | UpdateProductDto,
      'cover_image_url' | 'x_attributes_json'
    >,
  ) {
    const galleryImages = Array.isArray(dto.x_attributes_json?.gallery_images)
      ? dto.x_attributes_json?.gallery_images
      : [];

    if (!dto.cover_image_url && galleryImages.length === 0) {
      return;
    }

    const normalized = [
      ...(dto.cover_image_url ? [dto.cover_image_url] : []),
      ...galleryImages.filter(
        (url): url is string => typeof url === 'string' && url.length > 0,
      ),
    ].filter((url, index, list) => list.indexOf(url) === index);

    await this.imageRepo.delete({ product_tmpl_id: productId });

    if (normalized.length === 0) {
      return;
    }

    await this.imageRepo.save(
      normalized.map((url, index) =>
        this.imageRepo.create({
          product_tmpl_id: productId,
          image_url: url,
          file_name: this._extractFileName(url),
          original_name: this._extractFileName(url),
          mime_type: null,
          file_size: null,
          sort_order: index,
          is_cover: index === 0 ? 1 : 0,
        }),
      ),
    );
  }

  private _extractFileName(url: string) {
    const parts = url.split('/');
    return parts[parts.length - 1] ?? null;
  }

  private async _createExtension(tmplId: string, dto: CreateProductDto) {
    switch (dto.vertical_type) {
      case 'contractor':
        await this.contractorSvcRepo.save(
          this.contractorSvcRepo.create({
            product_tmpl_id: tmplId,
            service_type: dto.service_type ?? null,
            delivery_mode: dto.delivery_mode ?? 'on_site',
            quote_required: dto.quote_required !== false ? 1 : 0,
            site_visit_required: dto.site_visit_required ? 1 : 0,
            estimated_duration_hours:
              dto.estimated_duration_hours != null
                ? String(dto.estimated_duration_hours)
                : null,
            materials_included: dto.materials_included ? 1 : 0,
            service_area_json: dto.service_area_json ?? null,
          }),
        );
        break;
      case 'education_provider':
        await this.courseRepo.save(
          this.courseRepo.create({
            product_tmpl_id: tmplId,
            level: dto.level ?? null,
            duration_hours:
              dto.duration_hours != null ? String(dto.duration_hours) : null,
            language_code: dto.language_code ?? null,
            certificate_available: dto.certificate_available ? 1 : 0,
            course_mode: dto.course_mode ?? null,
            learning_outcomes_json: dto.learning_outcomes_json ?? null,
            requirements_json: dto.requirements_json ?? null,
            curriculum_json: dto.curriculum_json ?? null,
          }),
        );
        break;
      case 'hardware_store':
        await this.hardwareProductRepo.save(
          this.hardwareProductRepo.create({
            product_tmpl_id: tmplId,
            brand: dto.brand ?? null,
            model: dto.model ?? null,
            weight_kg: dto.weight_kg != null ? String(dto.weight_kg) : null,
            dimensions_json: dto.dimensions_json ?? null,
            technical_specs_json: dto.technical_specs_json ?? null,
            is_hazardous: dto.is_hazardous ? 1 : 0,
            bulk_price_json: dto.bulk_price_json ?? null,
          }),
        );
        break;
      case 'professional_firm':
        await this.professionalSvcRepo.save(
          this.professionalSvcRepo.create({
            product_tmpl_id: tmplId,
            service_type: dto.service_type ?? null,
            service_modality: dto.service_modality ?? null,
            appointment_required: dto.appointment_required ? 1 : 0,
            document_pack_type: dto.document_pack_type ?? null,
            legal_scope_json: dto.legal_scope_json ?? null,
          }),
        );
        break;
      case 'seo_agency':
        await this.seoSvcRepo.save(
          this.seoSvcRepo.create({
            product_tmpl_id: tmplId,
            service_scope: dto.service_scope ?? null,
            delivery_mode: dto.delivery_mode ?? 'remote',
            gbp_related: dto.gbp_related ? 1 : 0,
            geo_grid_enabled: dto.geo_grid_enabled ? 1 : 0,
            reporting_frequency: dto.reporting_frequency ?? null,
            deliverables_json: dto.deliverables_json ?? null,
          }),
        );
        break;
    }
  }

  async findAll(
    tenantId: string,
    filters: {
      vertical?: string;
      categ_id?: string;
      partner_id?: string;
      q?: string;
      min_price?: number;
      max_price?: number;
      published?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const qb = this.tmplRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.active = 1');
    if (filters.published !== 'false') qb.andWhere('p.is_published = 1');
    if (filters.vertical)
      qb.andWhere('p.vertical_type = :v', { v: filters.vertical });
    if (filters.categ_id)
      qb.andWhere('p.categ_id = :c', { c: filters.categ_id });
    if (filters.partner_id)
      qb.andWhere('p.partner_id = :pid', { pid: filters.partner_id });
    if (filters.q) qb.andWhere('p.name LIKE :q', { q: `%${filters.q}%` });
    if (filters.min_price)
      qb.andWhere('p.list_price >= :min', { min: filters.min_price });
    if (filters.max_price)
      qb.andWhere('p.list_price <= :max', { max: filters.max_price });
    const [data, total] = await qb
      .orderBy('p.rating_avg', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const tmpl = await this.tmplRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!tmpl) throw new NotFoundException('Product not found');
    let extension: any = null;
    switch (tmpl.vertical_type) {
      case 'contractor':
        extension = await this.contractorSvcRepo.findOne({
          where: { product_tmpl_id: id },
        });
        break;
      case 'education_provider':
        extension = await this.courseRepo.findOne({
          where: { product_tmpl_id: id },
        });
        break;
      case 'hardware_store':
        extension = await this.hardwareProductRepo.findOne({
          where: { product_tmpl_id: id },
        });
        break;
      case 'professional_firm':
        extension = await this.professionalSvcRepo.findOne({
          where: { product_tmpl_id: id },
        });
        break;
      case 'seo_agency':
        extension = await this.seoSvcRepo.findOne({
          where: { product_tmpl_id: id },
        });
        break;
    }
    const images = await this.imageRepo.find({
      where: { product_tmpl_id: id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    const variants = await this.variantRepo.find({
      where: { product_tmpl_id: id, active: 1 },
      order: { id: 'ASC' },
    });

    const variantIds = variants.map((variant) => variant.id);
    const stockQuants =
      variantIds.length > 0
        ? await this.stockQuantRepo.find({
            where: variantIds.map((variantId) => ({
              product_variant_id: variantId,
            })),
            order: { updated_at: 'DESC' },
          })
        : [];

    return { ...tmpl, extension, images, variants, stock_quants: stockQuants };
  }

  async findPublicOne(id: string) {
    const tmpl = await this.tmplRepo.findOne({
      where: { id, deleted_at: IsNull(), is_published: 1 },
    });
    if (!tmpl) throw new NotFoundException('Published product not found');

    return this.findOne(id);
  }

  async update(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    dto: UpdateProductDto,
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const tmpl = await this.tmplRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!tmpl) throw new NotFoundException('Product not found');
    if (tmpl.partner_id !== partnerId)
      throw new ForbiddenException('Not your product');

    const base: Record<string, any> = {};
    const baseKeys = [
      'categ_id',
      'name',
      'description_sale',
      'compare_price',
      'currency_code',
      'x_attributes_json',
      'seo_json',
      'cta_json',
      'cover_image_url',
    ];
    baseKeys.forEach((k) => {
      if ((dto as any)[k] !== undefined) base[k] = (dto as any)[k];
    });
    if (dto.list_price !== undefined) base.list_price = String(dto.list_price);
    if (Object.keys(base).length) await this.tmplRepo.update(id, base);

    await this._updateExtension(id, tmpl.vertical_type, dto);
    if (
      dto.cover_image_url !== undefined ||
      dto.x_attributes_json !== undefined
    ) {
      await this._syncImagesFromAttributes(id, {
        cover_image_url:
          dto.cover_image_url ?? tmpl.cover_image_url ?? undefined,
        x_attributes_json:
          dto.x_attributes_json !== undefined
            ? dto.x_attributes_json
            : (tmpl.x_attributes_json ?? undefined),
      });
    }
    return this.findOne(id);
  }

  private async _updateExtension(
    tmplId: string,
    verticalType: string,
    dto: UpdateProductDto,
  ) {
    const pick = (keys: string[]) => {
      const upd: Record<string, any> = {};
      keys.forEach((k) => {
        if ((dto as any)[k] !== undefined) upd[k] = (dto as any)[k];
      });
      return upd;
    };
    switch (verticalType) {
      case 'contractor': {
        const upd = pick([
          'service_type',
          'delivery_mode',
          'service_area_json',
        ]);
        if (dto.quote_required != null)
          upd.quote_required = dto.quote_required ? 1 : 0;
        if (dto.site_visit_required != null)
          upd.site_visit_required = dto.site_visit_required ? 1 : 0;
        if (dto.materials_included != null)
          upd.materials_included = dto.materials_included ? 1 : 0;
        if (dto.estimated_duration_hours != null)
          upd.estimated_duration_hours = String(dto.estimated_duration_hours);
        if (Object.keys(upd).length)
          await this.contractorSvcRepo.update({ product_tmpl_id: tmplId }, upd);
        break;
      }
      case 'education_provider': {
        const upd = pick([
          'level',
          'language_code',
          'course_mode',
          'learning_outcomes_json',
          'requirements_json',
          'curriculum_json',
        ]);
        if (dto.duration_hours != null)
          upd.duration_hours = String(dto.duration_hours);
        if (dto.certificate_available != null)
          upd.certificate_available = dto.certificate_available ? 1 : 0;
        if (Object.keys(upd).length)
          await this.courseRepo.update({ product_tmpl_id: tmplId }, upd);
        break;
      }
      case 'hardware_store': {
        const upd = pick([
          'brand',
          'model',
          'dimensions_json',
          'technical_specs_json',
          'bulk_price_json',
        ]);
        if (dto.weight_kg != null) upd.weight_kg = String(dto.weight_kg);
        if (dto.is_hazardous != null)
          upd.is_hazardous = dto.is_hazardous ? 1 : 0;
        if (Object.keys(upd).length)
          await this.hardwareProductRepo.update(
            { product_tmpl_id: tmplId },
            upd,
          );
        break;
      }
      case 'professional_firm': {
        const upd = pick([
          'service_type',
          'service_modality',
          'document_pack_type',
          'legal_scope_json',
        ]);
        if (dto.appointment_required != null)
          upd.appointment_required = dto.appointment_required ? 1 : 0;
        if (Object.keys(upd).length)
          await this.professionalSvcRepo.update(
            { product_tmpl_id: tmplId },
            upd,
          );
        break;
      }
      case 'seo_agency': {
        const upd = pick([
          'service_scope',
          'delivery_mode',
          'reporting_frequency',
          'deliverables_json',
        ]);
        if (dto.gbp_related != null) upd.gbp_related = dto.gbp_related ? 1 : 0;
        if (dto.geo_grid_enabled != null)
          upd.geo_grid_enabled = dto.geo_grid_enabled ? 1 : 0;
        if (Object.keys(upd).length)
          await this.seoSvcRepo.update({ product_tmpl_id: tmplId }, upd);
        break;
      }
    }
  }

  async remove(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const tmpl = await this.tmplRepo.findOne({ where: { id } });
    if (!tmpl) throw new NotFoundException('Product not found');
    if (tmpl.partner_id !== partnerId)
      throw new ForbiddenException('Not your product');
    await this.tmplRepo.update(id, { deleted_at: new Date() } as any);
    return { message: 'Product deleted' };
  }

  async setPublished(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    published: boolean,
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const tmpl = await this.tmplRepo.findOne({ where: { id } });
    if (!tmpl) throw new NotFoundException('Product not found');
    if (tmpl.partner_id !== partnerId)
      throw new ForbiddenException('Not your product');
    await this.tmplRepo.update(id, { is_published: published ? 1 : 0 });
    return this.findOne(id);
  }

  async syncImages(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    images: Array<{
      url: string;
      fileName?: string;
      originalName?: string;
      mimeType?: string;
      size?: number;
      isCover?: boolean;
      sortOrder?: number;
    }>,
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const tmpl = await this.tmplRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!tmpl) throw new NotFoundException('Product not found');
    if (tmpl.partner_id !== partnerId)
      throw new ForbiddenException('Not your product');

    const normalized = images
      .filter((image) => typeof image.url === 'string' && image.url.length > 0)
      .map((image, index) => ({
        image_url: image.url,
        file_name: image.fileName ?? this._extractFileName(image.url),
        original_name: image.originalName ?? image.fileName ?? null,
        mime_type: image.mimeType ?? null,
        file_size: image.size ?? null,
        sort_order: image.sortOrder ?? index,
        is_cover: image.isCover ? 1 : 0,
      }));

    if (
      normalized.length > 0 &&
      !normalized.some((image) => image.is_cover === 1)
    ) {
      normalized[0].is_cover = 1;
    }

    await this.imageRepo.delete({ product_tmpl_id: id });

    if (normalized.length > 0) {
      await this.imageRepo.save(
        normalized.map((image) =>
          this.imageRepo.create({
            product_tmpl_id: id,
            ...image,
          }),
        ),
      );
    }

    await this.tmplRepo.update(id, {
      cover_image_url:
        normalized.find((image) => image.is_cover === 1)?.image_url ?? null,
      x_attributes_json: {
        ...(tmpl.x_attributes_json ?? {}),
        gallery_images: normalized.map((image) => image.image_url),
      },
    });

    return this.findOne(id);
  }

  async getInventory(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const products = await this.tmplRepo.find({
      where: {
        tenant_id: user.tenant_id,
        partner_id: partnerId,
        vertical_type: 'hardware_store',
        deleted_at: IsNull(),
      },
      order: { updated_at: 'DESC' },
    });

    const productIds = products.map((product) => product.id);
    const variants =
      productIds.length > 0
        ? await this.variantRepo.find({
            where: productIds.map((productId) => ({
              product_tmpl_id: productId,
              active: 1,
            })),
          })
        : [];

    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    const stockQuants =
      variants.length > 0
        ? await this.stockQuantRepo.find({
            where: variants.map((variant) => ({
              tenant_id: user.tenant_id,
              partner_id: partnerId,
              product_variant_id: variant.id,
            })),
            order: { updated_at: 'DESC' },
          })
        : [];

    const grouped = new Map<
      string,
      {
        product: ProductTemplate;
        variant: ProductProduct | undefined;
        available: number;
        reserved: number;
        locations: string[];
        lastUpdated: Date | null;
      }
    >();

    products.forEach((product) => {
      const firstVariant = variants.find(
        (variant) => variant.product_tmpl_id === product.id,
      );
      grouped.set(product.id, {
        product,
        variant: firstVariant,
        available: 0,
        reserved: 0,
        locations: [],
        lastUpdated: null,
      });
    });

    stockQuants.forEach((quant) => {
      const variant = variantMap.get(quant.product_variant_id);
      if (!variant) return;

      const bucket = grouped.get(variant.product_tmpl_id);
      if (!bucket) return;

      bucket.available += Number(quant.quantity ?? 0);
      bucket.reserved += Number(quant.reserved_quantity ?? 0);
      if (quant.location_code) bucket.locations.push(quant.location_code);
      if (!bucket.lastUpdated || bucket.lastUpdated < quant.updated_at) {
        bucket.lastUpdated = quant.updated_at;
      }
    });

    const extensions =
      productIds.length > 0
        ? await this.hardwareProductRepo.find({
            where: productIds.map((productId) => ({
              product_tmpl_id: productId,
            })),
          })
        : [];

    const extensionMap = new Map(
      extensions.map((extension) => [extension.product_tmpl_id, extension]),
    );

    return Array.from(grouped.values()).map((entry) => {
      const product = entry.product;
      const extension = extensionMap.get(product.id);
      const minimum = Number(
        (product.x_attributes_json as any)?.minimum_stock ?? 5,
      );
      const categoryName = String(
        (product.x_attributes_json as any)?.category_name ?? 'Sin categoría',
      );

      return {
        product_id: product.id,
        variant_id: entry.variant?.id ?? null,
        sku:
          entry.variant?.sku ??
          product.default_code ??
          String((product.x_attributes_json as any)?.sku ?? '-'),
        name: product.name,
        brand: extension?.brand ?? '-',
        category: categoryName,
        location:
          entry.locations.length > 0
            ? Array.from(new Set(entry.locations)).join(', ')
            : 'Sin ubicación',
        available: entry.available,
        reserved: entry.reserved,
        minimum,
        cover_image_url: product.cover_image_url,
        updated_at: entry.lastUpdated ?? product.updated_at,
      };
    });
  }
}
