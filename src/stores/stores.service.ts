import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Tenant } from '../database/entities/core/tenant.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ContractorProfile } from '../database/entities/verticals/contractor-profile.entity';
import { EducationProviderProfile } from '../database/entities/verticals/education-provider-profile.entity';
import { HardwareStoreProfile } from '../database/entities/verticals/hardware-store-profile.entity';
import { ProfessionalFirmProfile } from '../database/entities/verticals/professional-firm-profile.entity';
import { SeoAgencyProfile } from '../database/entities/verticals/seo-agency-profile.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { mapLegacyStatusToFurStatus } from '../common/constants/marketplace.constants';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Tenant) private tenantsRepo: Repository<Tenant>,
    @InjectRepository(ResPartner) private partnersRepo: Repository<ResPartner>,
    @InjectRepository(ContractorProfile)
    private contractorRepo: Repository<ContractorProfile>,
    @InjectRepository(EducationProviderProfile)
    private eduRepo: Repository<EducationProviderProfile>,
    @InjectRepository(HardwareStoreProfile)
    private hardwareRepo: Repository<HardwareStoreProfile>,
    @InjectRepository(ProfessionalFirmProfile)
    private profRepo: Repository<ProfessionalFirmProfile>,
    @InjectRepository(SeoAgencyProfile)
    private seoRepo: Repository<SeoAgencyProfile>,
    @InjectRepository(ProductTemplate)
    private productsRepo: Repository<ProductTemplate>,
  ) {}

  private async attachRatingSummary<T extends { id: string }>(partners: T[]) {
    return partners.map((partner) => ({
      ...partner,
      rating_avg: '0.00',
      review_count: 0,
    }));
  }

  private async resolveManagedStore(
    storeId: string,
    user: { tenant_id: string; partner_id: string; email?: string },
  ) {
    const store = await this.partnersRepo.findOne({
      where: { id: storeId, tenant_id: user.tenant_id, deleted_at: IsNull() },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.id === user.partner_id) {
      return store;
    }

    const basePartner = await this.partnersRepo.findOne({
      where: { id: user.partner_id, tenant_id: user.tenant_id, deleted_at: IsNull() },
    });

    const effectiveEmail =
      user.email?.trim().toLowerCase() ??
      basePartner?.email?.trim().toLowerCase() ??
      null;

    const sameEmail =
      Boolean(effectiveEmail) &&
      Boolean(store.email) &&
      store.email!.trim().toLowerCase() === effectiveEmail;

    if (!sameEmail) {
      throw new ForbiddenException('Not allowed for this managed store');
    }

    return store;
  }

  async create(tenantId: string, dto: CreateStoreDto) {
    const furStatus = dto.x_verification_status ?? 'draft';
    const partner = await this.partnersRepo.save(
      this.partnersRepo.create({
        tenant_id: tenantId,
        entity_type: dto.entity_type,
        name: dto.name,
        legal_name: dto.legal_name ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        website: dto.website ?? null,
        logo_url: dto.logo_url ?? null,
        description: dto.description ?? null,
        street: dto.street ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        country: dto.country ?? null,
        zip: dto.zip ?? null,
        partner_latitude:
          dto.partner_latitude != null ? String(dto.partner_latitude) : null,
        partner_longitude:
          dto.partner_longitude != null ? String(dto.partner_longitude) : null,
        nap_json: dto.nap_json ?? null,
        attributes_json: {
          ...(dto.attributes_json ?? {}),
          fur_t: {
            ...(((dto.attributes_json ?? {}) as Record<string, any>).fur_t ?? {}),
            status: furStatus,
            updated_at: new Date().toISOString(),
          },
        },
        x_verification_status: furStatus,
      }),
    );
    await this._createProfile(partner.id, dto);
    return this.findOne(partner.id);
  }

  async createPublicOnboarding(dto: CreateStoreDto) {
    const tenantId = await this.resolvePublicTenantId();

    return this.create(tenantId, {
      ...dto,
      x_verification_status: 'draft',
      attributes_json: {
        ...(dto.attributes_json ?? {}),
        fur_t: {
          ...(((dto.attributes_json ?? {}) as Record<string, any>).fur_t ?? {}),
          status: 'draft',
          source: 'public_onboarding',
          updated_at: new Date().toISOString(),
        },
      },
    });
  }

  private async _createProfile(partnerId: string, dto: CreateStoreDto) {
    switch (dto.entity_type) {
      case 'contractor':
        await this.contractorRepo.save(
          this.contractorRepo.create({
            partner_id: partnerId,
            service_area_type: dto.service_area_type ?? null,
            coverage_radius_km:
              dto.coverage_radius_km != null
                ? String(dto.coverage_radius_km)
                : null,
            license_number: dto.license_number ?? null,
            insurance_verified: dto.insurance_verified ? 1 : 0,
            emergency_service: dto.emergency_service ? 1 : 0,
            availability_json: dto.availability_json ?? null,
          }),
        );
        break;
      case 'education_provider':
        await this.eduRepo.save(
          this.eduRepo.create({
            partner_id: partnerId,
            accreditation_status: dto.accreditation_status ?? null,
            institution_type: dto.institution_type ?? null,
            certification_enabled: dto.certification_enabled ? 1 : 0,
          }),
        );
        break;
      case 'hardware_store':
        await this.hardwareRepo.save(
          this.hardwareRepo.create({
            partner_id: partnerId,
            pickup_available: dto.pickup_available ? 1 : 0,
            b2b_enabled: dto.b2b_enabled ? 1 : 0,
            heavy_logistics_enabled: dto.heavy_logistics_enabled ? 1 : 0,
            warehouse_count: dto.warehouse_count ?? 0,
          }),
        );
        break;
      case 'professional_firm':
        await this.profRepo.save(
          this.profRepo.create({
            partner_id: partnerId,
            firm_type: dto.firm_type ?? null,
            license_registry: dto.license_registry ?? null,
            licensed_regions_json: dto.licensed_regions_json ?? null,
            digital_signature_enabled: dto.digital_signature_enabled ? 1 : 0,
            document_validation_status: 'draft',
          }),
        );
        break;
      case 'seo_agency':
        await this.seoRepo.save(
          this.seoRepo.create({
            partner_id: partnerId,
            google_partner_status: dto.google_partner_status ?? null,
            service_regions_json: dto.service_regions_json ?? null,
            tools_json: dto.tools_json ?? null,
            avg_response_time_hours:
              dto.avg_response_time_hours != null
                ? String(dto.avg_response_time_hours)
                : null,
          }),
        );
        break;
    }
  }

  async findAll(
    tenantId: string,
    filters: {
      vertical?: string;
      city?: string;
      verified?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const qb = this.partnersRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere("p.entity_type != 'customer'");
    if (filters.vertical)
      qb.andWhere('p.entity_type = :v', { v: filters.vertical });
    if (filters.city) qb.andWhere('p.city LIKE :c', { c: `%${filters.city}%` });
    if (filters.verified === 'true')
      qb.andWhere("p.x_verification_status = 'verified'");
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.name', 'ASC')
      .getManyAndCount();
    const enriched = await this.attachRatingSummary(data);
    return { data: enriched, total, page, limit };
  }

  async findPublic(filters: {
    vertical?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const qb = this.partnersRepo
      .createQueryBuilder('p')
      .where('p.deleted_at IS NULL')
      .andWhere("p.entity_type != 'customer'")
      .andWhere(
        `(
        JSON_UNQUOTE(JSON_EXTRACT(p.attributes_json, '$.fur_t.status')) = :publishedStatus
        OR p.x_verification_status IN (:...legacyPublishedStatuses)
      )`,
        {
          publishedStatus: 'published',
          legacyPublishedStatuses: ['published', 'approved', 'verified'],
        },
      );

    if (filters.vertical) {
      qb.andWhere('p.entity_type = :v', { v: filters.vertical });
    }

    if (filters.city) {
      qb.andWhere('p.city LIKE :c', { c: `%${filters.city}%` });
    }

    const [data, total] = await qb
      .orderBy('p.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const enriched = await this.attachRatingSummary(data);

    return { data: enriched, total, page, limit };
  }

  async findOne(id: string) {
    const partner = await this.partnersRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!partner) throw new NotFoundException('Store not found');
    let profile: any = null;
    switch (partner.entity_type) {
      case 'contractor':
        profile = await this.contractorRepo.findOne({
          where: { partner_id: id },
        });
        break;
      case 'education_provider':
        profile = await this.eduRepo.findOne({ where: { partner_id: id } });
        break;
      case 'hardware_store':
        profile = await this.hardwareRepo.findOne({
          where: { partner_id: id },
        });
        break;
      case 'professional_firm':
        profile = await this.profRepo.findOne({ where: { partner_id: id } });
        break;
      case 'seo_agency':
        profile = await this.seoRepo.findOne({ where: { partner_id: id } });
        break;
    }
    return { ...partner, profile };
  }

  async findPublicOne(id: string) {
    const partner = await this.findOne(id);
    const status = mapLegacyStatusToFurStatus(
      ((partner.attributes_json as Record<string, any> | null)?.fur_t
        ?.status as string | undefined) ?? partner.x_verification_status,
    );

    if (status !== 'published') {
      throw new NotFoundException('Published store not found');
    }

    const [enriched] = await this.attachRatingSummary([partner]);
    return enriched;
  }

  async update(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    dto: UpdateStoreDto,
  ) {
    const partner = await this.resolveManagedStore(id, user);

    const base: Record<string, any> = {};
    const baseKeys = [
      'name',
      'legal_name',
      'email',
      'phone',
      'website',
      'logo_url',
      'description',
      'street',
      'city',
      'state',
      'country',
      'zip',
      'nap_json',
    ];
    baseKeys.forEach((k) => {
      if ((dto as any)[k] !== undefined) base[k] = (dto as any)[k];
    });
    if (dto.partner_latitude !== undefined) {
      base.partner_latitude =
        dto.partner_latitude != null ? String(dto.partner_latitude) : null;
    }
    if (dto.partner_longitude !== undefined) {
      base.partner_longitude =
        dto.partner_longitude != null ? String(dto.partner_longitude) : null;
    }
    if (dto.attributes_json !== undefined) {
      base.attributes_json = {
        ...(partner.attributes_json ?? {}),
        ...(dto.attributes_json ?? {}),
      };
    }
    if (dto.x_verification_status !== undefined) {
      base.x_verification_status = dto.x_verification_status;
      base.attributes_json = {
        ...(base.attributes_json ?? partner.attributes_json ?? {}),
        fur_t: {
          ...(((base.attributes_json ?? partner.attributes_json ?? {}) as Record<string, any>)
            .fur_t ?? {}),
          status: dto.x_verification_status,
          updated_at: new Date().toISOString(),
        },
      };
    }
    if (Object.keys(base).length) await this.partnersRepo.update(id, base);

    await this.ensureProfileExists(id, partner.entity_type);
    await this._updateProfile(id, partner.entity_type, dto);
    return this.findOne(id);
  }

  async setPublished(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    published: boolean,
  ) {
    const partner = await this.resolveManagedStore(id, user);
    const attributes = (partner.attributes_json ?? {}) as Record<string, any>;
    const fur = (attributes.fur_t ?? {}) as Record<string, any>;
    const nextAttributes: Record<string, any> = {
      ...attributes,
      fur_t: {
        ...fur,
        status: published ? 'published' : 'draft',
        updated_at: new Date().toISOString(),
      },
    };

    await this.partnersRepo.update(id, {
      x_verification_status: published ? 'published' : 'draft',
      attributes_json: nextAttributes as any,
    });

    return this.findOne(id);
  }

  private async ensureProfileExists(partnerId: string, entityType: string) {
    switch (entityType) {
      case 'contractor': {
        const existing = await this.contractorRepo.findOne({
          where: { partner_id: partnerId },
        });
        if (!existing) {
          await this.contractorRepo.save(
            this.contractorRepo.create({
              partner_id: partnerId,
              insurance_verified: 0,
              emergency_service: 0,
            }),
          );
        }
        break;
      }
      case 'education_provider': {
        const existing = await this.eduRepo.findOne({
          where: { partner_id: partnerId },
        });
        if (!existing) {
          await this.eduRepo.save(
            this.eduRepo.create({
              partner_id: partnerId,
              certification_enabled: 0,
            }),
          );
        }
        break;
      }
      case 'hardware_store': {
        const existing = await this.hardwareRepo.findOne({
          where: { partner_id: partnerId },
        });
        if (!existing) {
          await this.hardwareRepo.save(
            this.hardwareRepo.create({
              partner_id: partnerId,
              pickup_available: 0,
              b2b_enabled: 0,
              heavy_logistics_enabled: 0,
              warehouse_count: 0,
            }),
          );
        }
        break;
      }
      case 'professional_firm': {
        const existing = await this.profRepo.findOne({
          where: { partner_id: partnerId },
        });
        if (!existing) {
          await this.profRepo.save(
            this.profRepo.create({
              partner_id: partnerId,
              document_validation_status: 'draft',
              digital_signature_enabled: 0,
            }),
          );
        }
        break;
      }
      case 'seo_agency': {
        const existing = await this.seoRepo.findOne({
          where: { partner_id: partnerId },
        });
        if (!existing) {
          await this.seoRepo.save(
            this.seoRepo.create({
              partner_id: partnerId,
            }),
          );
        }
        break;
      }
    }
  }

  private async _updateProfile(
    partnerId: string,
    entityType: string,
    dto: UpdateStoreDto,
  ) {
    const pick = (keys: string[]) => {
      const upd: Record<string, any> = {};
      keys.forEach((k) => {
        if ((dto as any)[k] !== undefined) upd[k] = (dto as any)[k];
      });
      return upd;
    };
    switch (entityType) {
      case 'contractor': {
        const upd = pick([
          'service_area_type',
          'license_number',
          'availability_json',
        ]);
        if (dto.coverage_radius_km != null)
          upd.coverage_radius_km = String(dto.coverage_radius_km);
        if (dto.insurance_verified != null)
          upd.insurance_verified = dto.insurance_verified ? 1 : 0;
        if (dto.emergency_service != null)
          upd.emergency_service = dto.emergency_service ? 1 : 0;
        if (Object.keys(upd).length)
          await this.contractorRepo.update({ partner_id: partnerId }, upd);
        break;
      }
      case 'education_provider': {
        const upd = pick(['accreditation_status', 'institution_type']);
        if (dto.certification_enabled != null)
          upd.certification_enabled = dto.certification_enabled ? 1 : 0;
        if (Object.keys(upd).length)
          await this.eduRepo.update({ partner_id: partnerId }, upd);
        break;
      }
      case 'hardware_store': {
        const upd = pick(['warehouse_count']);
        if (dto.pickup_available != null)
          upd.pickup_available = dto.pickup_available ? 1 : 0;
        if (dto.b2b_enabled != null) upd.b2b_enabled = dto.b2b_enabled ? 1 : 0;
        if (dto.heavy_logistics_enabled != null)
          upd.heavy_logistics_enabled = dto.heavy_logistics_enabled ? 1 : 0;
        if (Object.keys(upd).length)
          await this.hardwareRepo.update({ partner_id: partnerId }, upd);
        break;
      }
      case 'professional_firm': {
        const upd = pick([
          'firm_type',
          'license_registry',
          'licensed_regions_json',
        ]);
        if (dto.digital_signature_enabled != null)
          upd.digital_signature_enabled = dto.digital_signature_enabled ? 1 : 0;
        if (Object.keys(upd).length)
          await this.profRepo.update({ partner_id: partnerId }, upd);
        break;
      }
      case 'seo_agency': {
        const upd = pick([
          'google_partner_status',
          'service_regions_json',
          'tools_json',
        ]);
        if (dto.avg_response_time_hours != null)
          upd.avg_response_time_hours = String(dto.avg_response_time_hours);
        if (Object.keys(upd).length)
          await this.seoRepo.update({ partner_id: partnerId }, upd);
        break;
      }
    }
  }

  async getStoreProducts(storeId: string, page = 1, limit = 20) {
    const [data, total] = await this.productsRepo.findAndCount({
      where: { partner_id: storeId, active: 1, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async getPublicStoreProducts(storeId: string, page = 1, limit = 20) {
    const store = await this.findPublicOne(storeId);
    const [data, total] = await this.productsRepo.findAndCount({
      where: {
        partner_id: storeId,
        tenant_id: store.tenant_id,
        active: 1,
        is_published: 1,
        deleted_at: IsNull(),
      },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async getStoreRatings(_storeId: string, page = 1, limit = 10) {
    return { data: [], total: 0, page: Number(page), limit: Number(limit) };
  }

  async getPublicStoreRatings(storeId: string, page = 1, limit = 10) {
    await this.findPublicOne(storeId);
    return this.getStoreRatings(storeId, page, limit);
  }

  private async resolvePublicTenantId() {
    const masterTenant = await this.tenantsRepo.findOne({
      where: { slug: 'marketplace-master' },
    });

    if (masterTenant) {
      return masterTenant.id;
    }

    const fallback = await this.tenantsRepo.find({
      order: { id: 'ASC' },
      take: 1,
    });

    if (fallback[0]) {
      return fallback[0].id;
    }

    throw new NotFoundException('Marketplace tenant not found');
  }
}
