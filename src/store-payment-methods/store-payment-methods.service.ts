import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { StorePaymentMethod } from '../database/entities/payments/store-payment-method.entity';
import { UpsertStorePaymentMethodDto } from './dto/upsert-store-payment-method.dto';

@Injectable()
export class StorePaymentMethodsService {
  constructor(
    @InjectRepository(StorePaymentMethod)
    private readonly methodsRepo: Repository<StorePaymentMethod>,
    @InjectRepository(ResPartner)
    private readonly partnersRepo: Repository<ResPartner>,
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
        deleted_at: IsNull(),
      },
    });

    if (!partner) throw new NotFoundException('Managed store not found');

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

  async findMine(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    return this.methodsRepo.find({
      where: { tenant_id: user.tenant_id, partner_id: partnerId },
      order: { is_default: 'DESC', created_at: 'DESC' },
    });
  }

  async findPublic(storeId: string) {
    return this.methodsRepo.find({
      where: {
        partner_id: storeId,
        is_enabled: 1,
        verification_status: 'verified',
      },
      order: { is_default: 'DESC', created_at: 'ASC' },
    });
  }

  async create(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId: string | undefined,
    dto: UpsertStorePaymentMethodDto,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );

    if (dto.is_default) {
      await this.methodsRepo.update(
        { tenant_id: user.tenant_id, partner_id: partnerId },
        { is_default: 0 },
      );
    }

    return this.methodsRepo.save(
      this.methodsRepo.create({
        tenant_id: user.tenant_id,
        partner_id: partnerId,
        provider: dto.provider,
        method_type: dto.method_type,
        title: dto.title,
        instructions: dto.instructions ?? null,
        account_holder: dto.account_holder ?? null,
        account_number_masked: dto.account_number_masked ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        checkout_url: dto.checkout_url ?? null,
        payload_json: null,
        is_enabled: dto.is_enabled === false ? 0 : 1,
        is_default: dto.is_default ? 1 : 0,
        verification_status: 'verified',
      }),
    );
  }

  async update(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId: string | undefined,
    dto: UpsertStorePaymentMethodDto,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const method = await this.methodsRepo.findOne({
      where: { id, tenant_id: user.tenant_id, partner_id: partnerId },
    });
    if (!method) throw new NotFoundException('Store payment method not found');

    if (dto.is_default) {
      await this.methodsRepo.update(
        { tenant_id: user.tenant_id, partner_id: partnerId },
        { is_default: 0 },
      );
    }

    Object.assign(method, {
      provider: dto.provider,
      method_type: dto.method_type,
      title: dto.title,
      instructions: dto.instructions ?? null,
      account_holder: dto.account_holder ?? null,
      account_number_masked: dto.account_number_masked ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      checkout_url: dto.checkout_url ?? null,
      is_enabled: dto.is_enabled === false ? 0 : 1,
      is_default: dto.is_default ? 1 : 0,
    });

    return this.methodsRepo.save(method);
  }

  async remove(
    id: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId: string | undefined,
  ) {
    const partnerId = await this.resolveManagedPartnerId(
      user,
      requestedPartnerId,
    );
    const method = await this.methodsRepo.findOne({
      where: { id, tenant_id: user.tenant_id, partner_id: partnerId },
    });
    if (!method) throw new NotFoundException('Store payment method not found');
    await this.methodsRepo.delete(id);
    return { deleted: true };
  }
}
