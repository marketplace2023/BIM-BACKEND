import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ProductProduct } from '../database/entities/catalog/product-product.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { CommerceIntent } from '../database/entities/commerce/commerce-intent.entity';
import { CommerceIntentItem } from '../database/entities/commerce/commerce-intent-item.entity';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { SaleOrderLine } from '../database/entities/commerce/sale-order-line.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { StockQuant } from '../database/entities/inventory/stock-quant.entity';
import { StorePaymentMethod } from '../database/entities/payments/store-payment-method.entity';
import { AddIntentItemDto } from './dto/add-intent-item.dto';
import { CreatePublicProductIntentDto } from './dto/create-public-product-intent.dto';
import { SelectIntentPaymentMethodDto } from './dto/select-intent-payment-method.dto';
import { SubmitIntentPaymentProofDto } from './dto/submit-intent-payment-proof.dto';
import { UpdateIntentItemDto } from './dto/update-intent-item.dto';
import { UpdateIntentPaymentStatusDto } from './dto/update-intent-payment-status.dto';

const DEFAULT_INTENT_BY_VERTICAL: Record<string, string> = {
  hardware_store: 'catalog_purchase',
  education_provider: 'course_enrollment',
  seo_agency: 'service_request',
  professional_firm: 'service_request',
  contractor: 'quote_request',
};

const DEFAULT_ITEM_TYPE_BY_VERTICAL: Record<string, string> = {
  hardware_store: 'hardware_product',
  education_provider: 'course',
  seo_agency: 'seo_service',
  professional_firm: 'professional_service',
  contractor: 'contractor_service',
};

@Injectable()
export class IntentsService {
  constructor(
    @InjectRepository(CommerceIntent)
    private readonly intentsRepo: Repository<CommerceIntent>,
    @InjectRepository(CommerceIntentItem)
    private readonly itemsRepo: Repository<CommerceIntentItem>,
    @InjectRepository(ProductTemplate)
    private readonly productsRepo: Repository<ProductTemplate>,
    @InjectRepository(ProductProduct)
    private readonly variantsRepo: Repository<ProductProduct>,
    @InjectRepository(SaleOrder)
    private readonly ordersRepo: Repository<SaleOrder>,
    @InjectRepository(SaleOrderLine)
    private readonly orderLinesRepo: Repository<SaleOrderLine>,
    @InjectRepository(ResPartner)
    private readonly partnersRepo: Repository<ResPartner>,
    @InjectRepository(StorePaymentMethod)
    private readonly paymentMethodsRepo: Repository<StorePaymentMethod>,
    @InjectRepository(StockQuant)
    private readonly stockRepo: Repository<StockQuant>,
  ) {}

  private async hydrateIntent(intent: CommerceIntent) {
    const items = await this.itemsRepo.find({
      where: { intent_id: intent.id },
      order: { created_at: 'ASC' },
    });

    let convertedOrder: SaleOrder | null = null;
    if (intent.converted_order_id) {
      convertedOrder = await this.ordersRepo.findOne({
        where: { id: intent.converted_order_id },
        relations: ['payment_method'],
      });
    }

    let paymentMethod: StorePaymentMethod | null = null;
    if (intent.payment_method_id) {
      paymentMethod = await this.paymentMethodsRepo.findOne({
        where: { id: intent.payment_method_id },
      });
    }

    const [buyerPartner, storePartner] = await Promise.all([
      this.partnersRepo.findOne({ where: { id: intent.buyer_partner_id } }),
      this.partnersRepo.findOne({ where: { id: intent.store_partner_id } }),
    ]);

    return {
      ...intent,
      items,
      converted_order: convertedOrder,
      payment_method: paymentMethod,
      buyer_partner: buyerPartner,
      store_partner: storePartner,
    };
  }

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

  private async validateEducationPayload(payload?: Record<string, any>) {
    if (!payload?.student_name || !payload?.student_email) {
      throw new BadRequestException('Education enrollment requires student name and email');
    }
  }

  private async validateHardwareStock(product: ProductTemplate, qty: number) {
    const quants = await this.stockRepo.find({
      where: {
        tenant_id: product.tenant_id,
        partner_id: product.partner_id,
      },
    });

    const available = quants.reduce(
      (sum, item) => sum + Number(item.quantity ?? 0) - Number(item.reserved_quantity ?? 0),
      0,
    );
    const fallback = Number((product.x_attributes_json ?? {}).stock ?? 0);
    const finalAvailable = available > 0 ? available : fallback;

    if (finalAvailable > 0 && qty > finalAvailable) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }
  }

  private async findOrCreateDraftIntent(input: {
    tenantId: string;
    buyerPartnerId: string;
    storePartnerId: string;
    verticalType: string;
    intentType: string;
    currencyCode: string;
  }) {
    const existing = await this.intentsRepo.findOne({
      where: {
        tenant_id: input.tenantId,
        buyer_partner_id: input.buyerPartnerId,
        store_partner_id: input.storePartnerId,
        vertical_type: input.verticalType,
        intent_type: input.intentType,
        status: 'draft',
      },
    });

    if (existing) return existing;

    return this.intentsRepo.save(
      this.intentsRepo.create({
        tenant_id: input.tenantId,
        buyer_partner_id: input.buyerPartnerId,
        store_partner_id: input.storePartnerId,
        vertical_type: input.verticalType,
        intent_type: input.intentType,
          status: 'draft',
          currency_code: input.currencyCode,
          payment_status: 'unpaid',
          payment_method_id: null,
          payment_reference: null,
          payment_proof_url: null,
          payment_notes: null,
          paid_at: null,
          validated_by_store_user_id: null,
          validated_at: null,
          summary_json: null,
          converted_order_id: null,
        }),
    );
  }

  private async findOrCreatePublicBuyerPartner(input: {
    tenantId: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone?: string;
    company?: string;
    city?: string;
    country?: string;
  }) {
    const normalizedEmail = input.buyerEmail.trim().toLowerCase();

    const existing = await this.partnersRepo.findOne({
      where: {
        tenant_id: input.tenantId,
        entity_type: 'customer',
        email: normalizedEmail,
        deleted_at: IsNull(),
      },
    });

    if (existing) {
      Object.assign(existing, {
        name: input.buyerName,
        phone: input.buyerPhone ?? existing.phone,
        city: input.city ?? existing.city,
        country: input.country ?? existing.country,
        legal_name: input.company ?? existing.legal_name,
      });
      return this.partnersRepo.save(existing);
    }

    return this.partnersRepo.save(
      this.partnersRepo.create({
        tenant_id: input.tenantId,
        entity_type: 'customer',
        name: input.buyerName,
        legal_name: input.company ?? null,
        is_company: input.company ? 1 : 0,
        email: normalizedEmail,
        phone: input.buyerPhone ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        x_partner_role: 'consumer',
        x_verification_status: 'published',
        attributes_json: {
          source: 'public_product_lead',
        },
      }),
    );
  }

  async createPublicProductLead(dto: CreatePublicProductIntentDto) {
    const product = await this.productsRepo.findOne({
      where: {
        id: dto.product_tmpl_id,
        deleted_at: IsNull(),
        is_published: 1,
      },
    });

    if (!product) {
      throw new NotFoundException('Published product not found');
    }

    const storePartner = await this.partnersRepo.findOne({
      where: {
        id: product.partner_id,
        tenant_id: product.tenant_id,
        deleted_at: IsNull(),
      },
    });

    if (!storePartner || storePartner.x_verification_status !== 'published') {
      throw new NotFoundException('Published store not found');
    }

    const buyerPartner = await this.findOrCreatePublicBuyerPartner({
      tenantId: product.tenant_id,
      buyerName: dto.buyer_name.trim(),
      buyerEmail: dto.buyer_email.trim(),
      buyerPhone: dto.buyer_phone?.trim(),
      company: dto.company?.trim(),
      city: dto.city?.trim(),
      country: dto.country?.trim(),
    });

    const intentType = DEFAULT_INTENT_BY_VERTICAL[product.vertical_type] ?? 'quote_request';
    const qty = Number(dto.qty ?? 1);

    if (product.vertical_type === 'hardware_store') {
      await this.validateHardwareStock(product, qty);
    }

    const intent = await this.intentsRepo.save(
      this.intentsRepo.create({
        tenant_id: product.tenant_id,
        buyer_partner_id: buyerPartner.id,
        store_partner_id: product.partner_id,
        vertical_type: product.vertical_type,
        intent_type: intentType,
        status: 'submitted',
        currency_code: product.currency_code ?? 'USD',
        payment_status: 'unpaid',
        payment_method_id: null,
        payment_reference: null,
        payment_proof_url: null,
        payment_notes: null,
        paid_at: null,
        validated_by_store_user_id: null,
        validated_at: null,
        summary_json: {
          source: 'public_product_lead',
          buyer_name: dto.buyer_name,
          buyer_email: dto.buyer_email,
          buyer_phone: dto.buyer_phone ?? null,
          company: dto.company ?? null,
          city: dto.city ?? null,
          country: dto.country ?? null,
          message: dto.message ?? null,
        },
        converted_order_id: null,
      }),
    );

    await this.itemsRepo.save(
      this.itemsRepo.create({
        intent_id: intent.id,
        product_tmpl_id: product.id,
        product_variant_id: null,
        item_type: DEFAULT_ITEM_TYPE_BY_VERTICAL[product.vertical_type] ?? product.vertical_type,
        name_snapshot: product.name,
        price_snapshot: product.list_price,
        qty: String(qty),
        payload_json: {
          source: 'public_product_lead',
          message: dto.message ?? null,
        },
      }),
    );

    return {
      id: intent.id,
      status: intent.status,
      message: 'Lead created successfully',
    };
  }

  async addItem(
    user: { id: string; tenant_id: string; partner_id: string },
    dto: AddIntentItemDto,
  ) {
    const product = await this.productsRepo.findOne({
      where: {
        id: dto.product_tmpl_id,
        tenant_id: user.tenant_id,
        deleted_at: IsNull(),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const intentType = dto.intent_type ?? DEFAULT_INTENT_BY_VERTICAL[product.vertical_type];
    if (!intentType) {
      throw new BadRequestException('Unsupported vertical for commerce intent');
    }

    const qty = Number(dto.qty ?? 1);
    if (qty <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    if (product.vertical_type === 'education_provider') {
      await this.validateEducationPayload(dto.payload_json);
    }

    if (product.vertical_type === 'hardware_store') {
      await this.validateHardwareStock(product, qty);
    }

    if (dto.product_variant_id) {
      const variant = await this.variantsRepo.findOne({
        where: { id: dto.product_variant_id, product_tmpl_id: product.id },
      });
      if (!variant) {
        throw new BadRequestException('Invalid product variant for this product');
      }
    }

    const intent = await this.findOrCreateDraftIntent({
      tenantId: user.tenant_id,
      buyerPartnerId: user.partner_id,
      storePartnerId: product.partner_id,
      verticalType: product.vertical_type,
      intentType,
      currencyCode: product.currency_code ?? 'USD',
    });

    let item: CommerceIntentItem | null = null;

    if (product.vertical_type === 'hardware_store') {
      item = await this.itemsRepo.findOne({
        where: {
          intent_id: intent.id,
          product_tmpl_id: product.id,
          ...(dto.product_variant_id ? { product_variant_id: dto.product_variant_id } : {}),
        },
      });
    }

    if (item) {
      item.qty = String(Number(item.qty) + qty);
      item.payload_json = dto.payload_json ?? item.payload_json;
      await this.itemsRepo.save(item);
    } else {
      await this.itemsRepo.save(
        this.itemsRepo.create({
          intent_id: intent.id,
          product_tmpl_id: product.id,
          product_variant_id: dto.product_variant_id ?? null,
          item_type: DEFAULT_ITEM_TYPE_BY_VERTICAL[product.vertical_type] ?? product.vertical_type,
          name_snapshot: product.name,
          price_snapshot: product.list_price,
          qty: String(qty),
          payload_json: dto.payload_json ?? null,
        }),
      );
    }

    return this.hydrateIntent(intent);
  }

  async updateItem(
    itemId: string,
    user: { tenant_id: string; partner_id: string },
    dto: UpdateIntentItemDto,
  ) {
    const item = await this.itemsRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Intent item not found');

    const intent = await this.intentsRepo.findOne({ where: { id: item.intent_id } });
    if (!intent || intent.buyer_partner_id !== user.partner_id || intent.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('Access denied');
    }

    if (intent.status !== 'draft') {
      throw new BadRequestException('Only draft intents can be edited');
    }

    if (dto.qty != null) {
      item.qty = String(dto.qty);
    }

    if (dto.payload_json !== undefined) {
      item.payload_json = dto.payload_json ?? null;
    }

    await this.itemsRepo.save(item);
    return this.hydrateIntent(intent);
  }

  async removeItem(itemId: string, user: { tenant_id: string; partner_id: string }) {
    const item = await this.itemsRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Intent item not found');

    const intent = await this.intentsRepo.findOne({ where: { id: item.intent_id } });
    if (!intent || intent.buyer_partner_id !== user.partner_id || intent.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('Access denied');
    }

    if (intent.status !== 'draft') {
      throw new BadRequestException('Only draft intents can be edited');
    }

    await this.itemsRepo.delete(itemId);
    const remaining = await this.itemsRepo.count({ where: { intent_id: intent.id } });
    if (remaining === 0) {
      await this.intentsRepo.delete(intent.id);
      return { deleted: true };
    }

    return this.hydrateIntent(intent);
  }

  async findMine(
    user: { tenant_id: string; partner_id: string },
    filters: { verticalType?: string; intentType?: string; status?: string },
  ) {
    const qb = this.intentsRepo
      .createQueryBuilder('intent')
      .where('intent.tenant_id = :tenantId', { tenantId: user.tenant_id })
      .andWhere('intent.buyer_partner_id = :buyerPartnerId', { buyerPartnerId: user.partner_id })
      .orderBy('intent.updated_at', 'DESC');

    if (filters.verticalType) {
      qb.andWhere('intent.vertical_type = :verticalType', { verticalType: filters.verticalType });
    }
    if (filters.intentType) {
      qb.andWhere('intent.intent_type = :intentType', { intentType: filters.intentType });
    }
    if (filters.status) {
      qb.andWhere('intent.status = :status', { status: filters.status });
    }

    const intents = await qb.getMany();
    return Promise.all(intents.map((intent) => this.hydrateIntent(intent)));
  }

  async findStore(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedStorePartnerId: string | undefined,
    filters: { verticalType?: string; intentType?: string; status?: string },
  ) {
    const managedPartnerId = await this.resolveManagedPartnerId(user, requestedStorePartnerId);

    const qb = this.intentsRepo
      .createQueryBuilder('intent')
      .where('intent.tenant_id = :tenantId', { tenantId: user.tenant_id })
      .andWhere('intent.store_partner_id = :storePartnerId', { storePartnerId: managedPartnerId })
      .orderBy('intent.updated_at', 'DESC');

    if (filters.verticalType) {
      qb.andWhere('intent.vertical_type = :verticalType', { verticalType: filters.verticalType });
    }
    if (filters.intentType) {
      qb.andWhere('intent.intent_type = :intentType', { intentType: filters.intentType });
    }
    if (filters.status) {
      qb.andWhere('intent.status = :status', { status: filters.status });
    }

    const intents = await qb.getMany();
    return Promise.all(intents.map((intent) => this.hydrateIntent(intent)));
  }

  async submit(
    intentId: string,
    user: { tenant_id: string; partner_id: string },
  ) {
    const intent = await this.intentsRepo.findOne({
      where: { id: intentId, tenant_id: user.tenant_id },
    });

    if (!intent || intent.buyer_partner_id !== user.partner_id) {
      throw new ForbiddenException('Access denied');
    }

    if (intent.status !== 'draft') {
      throw new BadRequestException('Only draft intents can be submitted');
    }

    const items = await this.itemsRepo.find({ where: { intent_id: intent.id } });
    if (items.length === 0) {
      throw new BadRequestException('Intent has no items');
    }

    if (!['catalog_purchase', 'course_enrollment'].includes(intent.intent_type)) {
      intent.status = 'submitted';
      intent.summary_json = {
        ...(intent.summary_json ?? {}),
        submitted_at: new Date().toISOString(),
      };
      await this.intentsRepo.save(intent);
      return this.hydrateIntent(intent);
    }

    let amountUntaxed = 0;
    for (const item of items) {
      amountUntaxed += Number(item.qty) * Number(item.price_snapshot);
    }

    const order = await this.ordersRepo.save(
      this.ordersRepo.create({
        tenant_id: intent.tenant_id,
        partner_id: intent.buyer_partner_id,
        x_professional_id: intent.store_partner_id,
        order_number: `ORD-${Date.now()}`,
        status: 'confirmed',
        payment_status: 'pending_method_selection',
        payment_method_id: null,
        payment_reference: null,
        payment_proof_url: null,
        payment_notes: null,
        paid_at: null,
        validated_by_store_user_id: null,
        validated_at: null,
        currency_code: intent.currency_code,
        amount_untaxed: amountUntaxed.toFixed(2),
        amount_tax: '0.00',
        amount_total: amountUntaxed.toFixed(2),
        meta_json: {
          intent_id: intent.id,
          intent_type: intent.intent_type,
          vertical_type: intent.vertical_type,
        },
      }),
    );

    for (const item of items) {
      await this.orderLinesRepo.save(
        this.orderLinesRepo.create({
          order_id: order.id,
          product_tmpl_id: item.product_tmpl_id,
          product_variant_id: item.product_variant_id,
          name: item.name_snapshot,
          qty: item.qty,
          price_unit: item.price_snapshot,
          discount: '0.00',
          subtotal: (Number(item.qty) * Number(item.price_snapshot)).toFixed(2),
          line_meta_json: item.payload_json ?? null,
        }),
      );
    }

    intent.status = 'converted';
    intent.converted_order_id = order.id;
    intent.summary_json = {
      ...(intent.summary_json ?? {}),
      submitted_at: new Date().toISOString(),
      order_number: order.order_number,
      order_status: order.status,
    };
    await this.intentsRepo.save(intent);

    return this.hydrateIntent(intent);
  }

  async selectPaymentMethod(
    intentId: string,
    user: { tenant_id: string; partner_id: string },
    dto: SelectIntentPaymentMethodDto,
  ) {
    const intent = await this.intentsRepo.findOne({ where: { id: intentId, tenant_id: user.tenant_id } });
    if (!intent || intent.buyer_partner_id !== user.partner_id) {
      throw new ForbiddenException('Access denied');
    }
    if (!['service_request', 'quote_request'].includes(intent.intent_type)) {
      throw new BadRequestException('This intent does not support store payment methods');
    }
    if (intent.status === 'draft' || intent.status === 'cancelled') {
      throw new BadRequestException('Submit the request before selecting a payment method');
    }

    const method = await this.paymentMethodsRepo.findOne({
      where: {
        id: dto.payment_method_id,
        tenant_id: user.tenant_id,
        partner_id: intent.store_partner_id,
        is_enabled: 1,
      },
    });
    if (!method) {
      throw new NotFoundException('Store payment method not found');
    }

    intent.payment_method_id = method.id;
    intent.payment_status = 'pending_proof';
    await this.intentsRepo.save(intent);
    return this.hydrateIntent(intent);
  }

  async submitPaymentProof(
    intentId: string,
    user: { tenant_id: string; partner_id: string },
    dto: SubmitIntentPaymentProofDto,
  ) {
    const intent = await this.intentsRepo.findOne({ where: { id: intentId, tenant_id: user.tenant_id } });
    if (!intent || intent.buyer_partner_id !== user.partner_id) {
      throw new ForbiddenException('Access denied');
    }
    if (!intent.payment_method_id) {
      throw new ForbiddenException('Select a payment method first');
    }

    intent.payment_reference = dto.payment_reference ?? null;
    intent.payment_proof_url = dto.payment_proof_url ?? null;
    intent.payment_notes = dto.payment_notes ?? null;
    intent.payment_status = 'pending_validation';
    await this.intentsRepo.save(intent);
    return this.hydrateIntent(intent);
  }

  async updateStatus(
    intentId: string,
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedStorePartnerId: string | undefined,
    status: string,
  ) {
    const managedPartnerId = await this.resolveManagedPartnerId(user, requestedStorePartnerId);
    const intent = await this.intentsRepo.findOne({
      where: { id: intentId, tenant_id: user.tenant_id },
    });

    if (!intent || intent.store_partner_id !== managedPartnerId) {
      throw new ForbiddenException('Access denied');
    }

    const allowed = ['review', 'confirmed', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new BadRequestException('Invalid intent status transition');
    }

    if (intent.intent_type !== 'service_request' && intent.intent_type !== 'quote_request') {
      throw new BadRequestException('Only service or quote requests can be updated from seller panel');
    }

    if (status === 'confirmed' && intent.payment_status !== 'paid') {
      throw new BadRequestException('A paid request is required before confirming this service');
    }

    intent.status = status;
    intent.summary_json = {
      ...(intent.summary_json ?? {}),
      seller_updated_at: new Date().toISOString(),
    };
    await this.intentsRepo.save(intent);

    return this.hydrateIntent(intent);
  }

  async updatePaymentStatus(
    intentId: string,
    user: { id: string; tenant_id: string; partner_id: string; email?: string },
    requestedStorePartnerId: string | undefined,
    dto: UpdateIntentPaymentStatusDto,
  ) {
    const managedPartnerId = await this.resolveManagedPartnerId(user, requestedStorePartnerId);
    const intent = await this.intentsRepo.findOne({ where: { id: intentId, tenant_id: user.tenant_id } });
    if (!intent || intent.store_partner_id !== managedPartnerId) {
      throw new ForbiddenException('Access denied');
    }
    if (!['service_request', 'quote_request'].includes(intent.intent_type)) {
      throw new BadRequestException('This intent does not support payment validation');
    }

    intent.payment_status = dto.payment_status;
    if (dto.payment_status === 'paid') {
      intent.paid_at = new Date();
    }
    intent.validated_by_store_user_id = user.id;
    intent.validated_at = new Date();
    await this.intentsRepo.save(intent);
    return this.hydrateIntent(intent);
  }
}
