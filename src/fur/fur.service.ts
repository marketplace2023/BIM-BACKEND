import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  mapFurStatusToLegacy,
  mapLegacyStatusToFurStatus,
  type FurStatus,
  type MarketplaceRole,
} from '../common/constants/marketplace.constants';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { UpsertStoreGbpDto } from './dto/upsert-store-gbp.dto';

@Injectable()
export class FurService {
  constructor(
    @InjectRepository(ResPartner)
    private readonly partnersRepo: Repository<ResPartner>,
    @InjectRepository(ResUser)
    private readonly usersRepo: Repository<ResUser>,
    @InjectRepository(ProductTemplate)
    private readonly productsRepo: Repository<ProductTemplate>,
  ) {}

  async getWorkspace(user: {
    id: string;
    partner_id: string;
    role?: string;
    roles?: string[];
  }) {
    const [account, store] = await Promise.all([
      this.loadUser(user.id),
      this.loadPartner(user.partner_id),
    ]);
    const role = this.resolveRole(user.role, user.roles, store.x_partner_role);

    const publishedProducts =
      role === 'store'
        ? await this.productsRepo.count({
            where: {
              partner_id: store.id,
              deleted_at: IsNull(),
              active: 1,
              is_published: 1,
            },
          })
        : 0;

    return {
      role,
      roles: user.roles ?? [role],
      entity_type: store.entity_type,
      fur_u: this.buildUserFur(account, role),
      fur_t: role !== 'consumer' ? this.buildStoreFur(store) : null,
      fur_gbp: role !== 'consumer' ? this.buildGbpFur(store) : null,
      pending_actions: this.buildPendingActions({
        role,
        store,
        user: account,
        publishedProducts,
      }),
    };
  }

  async getStoreFur(storeId: string) {
    const store = await this.loadPartner(storeId);
    return {
      fur_t: this.buildStoreFur(store),
      fur_gbp: this.buildGbpFur(store),
    };
  }

  async getProductFur(productId: string) {
    const product = await this.loadProduct(productId);
    return {
      fur_p: this.buildProductFur(product),
    };
  }

  async updateStoreStatus(
    storeId: string,
    status: FurStatus,
    user: { partner_id: string; role?: string; roles?: string[] },
  ) {
    const store = await this.loadPartner(storeId);
    const role = this.resolveRole(user.role, user.roles, store.x_partner_role);
    const isOwner = user.partner_id === storeId;

    if (role === 'admin') {
      return this.persistStoreStatus(store, status);
    }

    if (isOwner && (status === 'draft' || status === 'review')) {
      return this.persistStoreStatus(store, status);
    }

    throw new ForbiddenException(
      'You do not have permissions to change this FUR-T status',
    );
  }

  async updateUserStatus(
    userId: string,
    status: FurStatus,
    requester: { role?: string; roles?: string[] },
  ) {
    const role = this.resolveRole(requester.role, requester.roles);
    if (role !== 'admin') {
      throw new ForbiddenException('Only admins can update FUR-U status');
    }

    const user = await this.loadUser(userId);
    const security = this.getUserSecurity(user);
    const fur_u = { ...(security.fur_u ?? {}), status };

    await this.usersRepo.update(user.id, {
      kyc_status: mapFurStatusToLegacy(status),
      security_json: {
        ...security,
        fur_u,
      },
    });

    return this.getWorkspace({
      id: user.id,
      partner_id: user.partner_id,
      role,
      roles: requester.roles,
    });
  }

  async updateProductStatus(
    productId: string,
    status: FurStatus,
    user: { partner_id: string; role?: string; roles?: string[] },
  ) {
    const product = await this.loadProduct(productId);
    const role = this.resolveRole(user.role, user.roles);
    const isOwner = user.partner_id === product.partner_id;

    if (
      role !== 'admin' &&
      !(isOwner && (status === 'draft' || status === 'review'))
    ) {
      throw new ForbiddenException(
        'You do not have permissions to change this FUR-P status',
      );
    }

    const attrs = this.getProductAttributes(product);
    const nextAttrs = {
      ...attrs,
      fur_p: {
        ...(attrs.fur_p ?? {}),
        status,
      },
    };

    await this.productsRepo.update(product.id, {
      x_attributes_json: nextAttrs,
      is_published: status === 'published' ? 1 : 0,
      active: status === 'suspended' ? 0 : 1,
    });

    return this.getProductFur(product.id);
  }

  async saveStoreGbpProfile(
    storeId: string,
    dto: UpsertStoreGbpDto,
    user: { partner_id: string; role?: string; roles?: string[] },
  ) {
    const store = await this.loadPartner(storeId);
    const role = this.resolveRole(user.role, user.roles, store.x_partner_role);

    if (role !== 'admin' && user.partner_id !== storeId) {
      throw new ForbiddenException(
        'You do not have access to update this FUR-GBP profile',
      );
    }

    const attrs = this.getPartnerAttributes(store);
    const current = this.getPartnerAttributes(store).fur_gbp ?? {};
    const linked = dto.linked ?? true;
    const next = {
      ...current,
      ...dto,
      linked,
      status: linked ? 'published' : 'draft',
      updated_at: new Date().toISOString(),
    };

    await this.partnersRepo.update(store.id, {
      attributes_json: {
        ...attrs,
        fur_gbp: next,
      },
    });

    return this.getStoreFur(store.id);
  }

  private async persistStoreStatus(store: ResPartner, status: FurStatus) {
    const attrs = this.getPartnerAttributes(store);
    await this.partnersRepo.update(store.id, {
      x_verification_status: mapFurStatusToLegacy(status),
      attributes_json: {
        ...attrs,
        fur_t: {
          ...(attrs.fur_t ?? {}),
          status,
          updated_at: new Date().toISOString(),
        },
      },
    });

    return this.getStoreFur(store.id);
  }

  private buildPendingActions(input: {
    role: MarketplaceRole;
    store: ResPartner;
    user: ResUser;
    publishedProducts: number;
  }) {
    const actions: string[] = [];
    const userStatus = this.getUserStatus(input.user);
    const storeStatus = this.getStoreStatus(input.store);

    if (userStatus !== 'published') {
      actions.push('Tu cuenta aun no ha sido validada por administracion');
    }

    if (input.role === 'store') {
      if (storeStatus === 'draft') {
        actions.push(
          'Completa la ficha publica del negocio y enviala a revision',
        );
      }
      if (storeStatus === 'review') {
        actions.push('Tu negocio esta en revision por administracion');
      }
      if (storeStatus === 'published' && input.publishedProducts === 0) {
        actions.push('Crea y envia a revision tu primer producto o servicio');
      }
    }

    return actions;
  }

  private buildUserFur(user: ResUser, role: MarketplaceRole) {
    const security = this.getUserSecurity(user);
    return {
      id: user.id,
      status: this.getUserStatus(user),
      role,
      email: user.email,
      username: user.username,
      email_verified: Boolean(user.is_email_verified),
      compliance: {
        kyc_status: user.kyc_status,
      },
      audit: {
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at,
      },
      security: security,
    };
  }

  private buildStoreFur(store: ResPartner) {
    const attrs = this.getPartnerAttributes(store);
    const fur_t = attrs.fur_t ?? {};
    return {
      id: store.id,
      status: this.getStoreStatus(store),
      role: store.x_partner_role ?? 'store',
      entity_type: store.entity_type,
      identity: {
        name: store.name,
        legal_name: store.legal_name,
      },
      contact: {
        email: store.email,
        phone: store.phone,
        website: store.website,
      },
      location: {
        street: store.street,
        city: store.city,
        state: store.state,
        country: store.country,
        zip: store.zip,
        latitude: store.partner_latitude,
        longitude: store.partner_longitude,
      },
      reputation: {
        verification_status: store.x_verification_status,
      },
      public_profile: attrs.public_profile ?? null,
      seo: fur_t.seo ?? null,
      compliance: fur_t.compliance ?? null,
      audit: {
        created_at: store.created_at,
        updated_at: store.updated_at,
      },
    };
  }

  private buildGbpFur(store: ResPartner) {
    const attrs = this.getPartnerAttributes(store);
    const gbp = attrs.fur_gbp ?? {};
    return {
      status: gbp.status ?? 'draft',
      linked: Boolean(gbp.linked),
      account_name: gbp.account_name ?? null,
      location_name: gbp.location_name ?? null,
      title: gbp.title ?? null,
      website_uri: gbp.website_uri ?? null,
      primary_phone: gbp.primary_phone ?? null,
      address: gbp.address ?? null,
      place_id: gbp.place_id ?? null,
      maps_uri: gbp.maps_uri ?? null,
      categories: gbp.categories ?? [],
      metadata: gbp.metadata ?? null,
    };
  }

  private buildProductFur(product: ProductTemplate) {
    const attrs = this.getProductAttributes(product);
    const fur_p = attrs.fur_p ?? {};
    return {
      id: product.id,
      status: this.getProductStatus(product),
      entity_type: product.vertical_type,
      listing_type: product.listing_type,
      identity: {
        name: product.name,
        slug: product.slug,
      },
      commerce: {
        list_price: product.list_price,
        compare_price: product.compare_price,
        currency_code: product.currency_code,
      },
      seo: product.seo_json ?? null,
      compliance: fur_p.compliance ?? null,
      audit: {
        created_at: product.created_at,
        updated_at: product.updated_at,
      },
    };
  }

  private getUserStatus(user: ResUser): FurStatus {
    const security = this.getUserSecurity(user);
    return (
      (security.fur_u?.status as FurStatus | undefined) ??
      mapLegacyStatusToFurStatus(user.kyc_status)
    );
  }

  private getStoreStatus(store: ResPartner): FurStatus {
    const attrs = this.getPartnerAttributes(store);
    return (
      (attrs.fur_t?.status as FurStatus | undefined) ??
      mapLegacyStatusToFurStatus(store.x_verification_status)
    );
  }

  private getProductStatus(product: ProductTemplate): FurStatus {
    const attrs = this.getProductAttributes(product);
    if (attrs.fur_p?.status) {
      return attrs.fur_p.status as FurStatus;
    }
    if (!product.active) return 'suspended';
    if (product.is_published) return 'published';
    return 'draft';
  }

  private getUserSecurity(user: ResUser): Record<string, any> {
    return user.security_json ?? {};
  }

  private getPartnerAttributes(store: ResPartner): Record<string, any> {
    return store.attributes_json ?? {};
  }

  private getProductAttributes(product: ProductTemplate): Record<string, any> {
    return product.x_attributes_json ?? {};
  }

  private resolveRole(
    role?: string,
    roles: string[] = [],
    partnerRole?: string | null,
  ): MarketplaceRole {
    if (
      role === 'admin' ||
      roles.includes('admin') ||
      partnerRole === 'admin'
    ) {
      return 'admin';
    }
    if (
      role === 'store' ||
      roles.includes('store') ||
      partnerRole === 'store'
    ) {
      return 'store';
    }
    return 'consumer';
  }

  private async loadPartner(id: string) {
    const store = await this.partnersRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!store) throw new NotFoundException('FUR-T not found');
    return store;
  }

  private async loadUser(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('FUR-U not found');
    return user;
  }

  private async loadProduct(id: string) {
    const product = await this.productsRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!product) throw new NotFoundException('FUR-P not found');
    return product;
  }
}
