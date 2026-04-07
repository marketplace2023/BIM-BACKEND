import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { IsNull, Repository } from 'typeorm';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { MarketplacePlan } from '../database/entities/payments/marketplace-plan.entity';
import { PartnerListingPayment } from '../database/entities/payments/partner-listing-payment.entity';
import { PartnerListingSubscription } from '../database/entities/payments/partner-listing-subscription.entity';
import { CreateBillingCheckoutIntentDto } from './dto/create-billing-checkout-intent.dto';

const DEFAULT_MARKETPLACE_PLANS = [
  {
    code: 'listing-basic',
    name: 'Publicación Básica',
    description: 'Activa una sede en el marketplace con ficha pública y acceso al panel.',
    billing_type: 'one_time',
    amount: '29.00',
    currency_code: 'USD',
    features_json: {
      items: ['Ficha pública', 'Panel seller', 'Soporte inicial', 'Acceso a reseñas'],
    },
  },
  {
    code: 'listing-pro',
    name: 'Publicación Pro',
    description: 'Incluye presencia destacada y prioridad de revisión administrativa.',
    billing_type: 'one_time',
    amount: '79.00',
    currency_code: 'USD',
    features_json: {
      items: ['Ficha pública', 'Panel seller', 'Prioridad de revisión', 'Mayor visibilidad'],
    },
  },
];

@Injectable()
export class BillingService {
  private readonly stripe: Stripe | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(MarketplacePlan)
    private readonly plansRepo: Repository<MarketplacePlan>,
    @InjectRepository(PartnerListingSubscription)
    private readonly subscriptionsRepo: Repository<PartnerListingSubscription>,
    @InjectRepository(PartnerListingPayment)
    private readonly paymentsRepo: Repository<PartnerListingPayment>,
    @InjectRepository(ResPartner)
    private readonly partnersRepo: Repository<ResPartner>,
    @InjectRepository(ResUser)
    private readonly usersRepo: Repository<ResUser>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey
      ? new Stripe(secretKey, {
          apiVersion: '2026-03-25.dahlia',
        })
      : null;
  }

  private requireStripe() {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured in this environment');
    }

    return this.stripe;
  }

  private async ensureDefaultPlans(tenantId: string) {
    const count = await this.plansRepo.count({ where: { tenant_id: tenantId } });
    if (count > 0) return;

    await this.plansRepo.save(
      DEFAULT_MARKETPLACE_PLANS.map((plan) =>
        this.plansRepo.create({
          tenant_id: tenantId,
          ...plan,
          is_active: 1,
        }),
      ),
    );
  }

  private async resolveManagedPartnerId(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
  ) {
    if (!requestedPartnerId || requestedPartnerId === user.partner_id) {
      return user.partner_id;
    }

    const partner = await this.partnersRepo.findOne({
      where: { id: requestedPartnerId, tenant_id: user.tenant_id, deleted_at: IsNull() },
    });

    if (!partner) {
      throw new NotFoundException('Managed store not found');
    }

    const basePartner = await this.partnersRepo.findOne({
      where: { id: user.partner_id, tenant_id: user.tenant_id, deleted_at: IsNull() },
    });

    const effectiveEmail = user.email?.trim().toLowerCase() ?? basePartner?.email?.trim().toLowerCase() ?? null;
    const sameEmail = Boolean(effectiveEmail) && Boolean(partner.email) && partner.email!.trim().toLowerCase() === effectiveEmail;

    if (!sameEmail) {
      throw new ForbiddenException('Not allowed for this managed store');
    }

    return partner.id;
  }

  private async syncPartnerBillingState(
    partnerId: string,
    input: { subscriptionStatus: string; paymentStatus?: string; planCode?: string },
  ) {
    const partner = await this.partnersRepo.findOne({ where: { id: partnerId } });
    if (!partner) return;

    const attrs = (partner.attributes_json ?? {}) as Record<string, any>;
    await this.partnersRepo.update(partnerId, {
      attributes_json: {
        ...attrs,
        marketplace_billing: {
          ...(attrs.marketplace_billing ?? {}),
          status: input.subscriptionStatus,
          payment_status: input.paymentStatus ?? attrs.marketplace_billing?.payment_status ?? null,
          plan_code: input.planCode ?? attrs.marketplace_billing?.plan_code ?? null,
          updated_at: new Date().toISOString(),
        },
      },
    });
  }

  private async getActiveOrLatestSubscription(partnerId: string) {
    return this.subscriptionsRepo.findOne({
      where: { partner_id: partnerId },
      order: { created_at: 'DESC' },
      relations: ['plan'],
    });
  }

  async getPlans(tenantId: string) {
    await this.ensureDefaultPlans(tenantId);
    return this.plansRepo.find({
      where: { tenant_id: tenantId, is_active: 1 },
      order: { amount: 'ASC' },
    });
  }

  async getMySubscription(user: { tenant_id: string; partner_id: string; email?: string }, requestedPartnerId?: string) {
    const partnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);
    const subscription = await this.getActiveOrLatestSubscription(partnerId);
    const latestPayment = subscription
      ? await this.paymentsRepo.findOne({
          where: { subscription_id: subscription.id },
          order: { created_at: 'DESC' },
        })
      : null;

    return {
      subscription,
      latest_payment: latestPayment,
      publishable_key: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? null,
    };
  }

  async createCheckoutIntent(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId: string | undefined,
    dto: CreateBillingCheckoutIntentDto,
  ) {
    const stripe = this.requireStripe();
    const partnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);
    await this.ensureDefaultPlans(user.tenant_id);

    const partner = await this.partnersRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundException('Store not found');
    }

    const plan = await this.plansRepo.findOne({
      where: { tenant_id: user.tenant_id, code: dto.plan_code, is_active: 1 },
    });
    if (!plan) {
      throw new NotFoundException('Marketplace plan not found');
    }

    let subscription = await this.getActiveOrLatestSubscription(partnerId);
    if (!subscription || subscription.status === 'expired' || subscription.status === 'cancelled') {
      subscription = await this.subscriptionsRepo.save(
        this.subscriptionsRepo.create({
          tenant_id: user.tenant_id,
          partner_id: partnerId,
          plan_id: plan.id,
          status: 'pending_payment',
          starts_at: null,
          expires_at: null,
          is_auto_renew: 0,
          activated_by_admin_user_id: null,
          activated_at: null,
          notes: null,
        }),
      );
    } else if (subscription.plan_id !== plan.id) {
      subscription.plan_id = plan.id;
      subscription.status = 'pending_payment';
      subscription.activated_at = null;
      subscription.activated_by_admin_user_id = null;
      await this.subscriptionsRepo.save(subscription);
    }

    const payment = await this.paymentsRepo.save(
      this.paymentsRepo.create({
        tenant_id: user.tenant_id,
        partner_id: partnerId,
        subscription_id: subscription.id,
        provider: 'stripe',
        provider_ref: null,
        status: 'pending',
        amount: plan.amount,
        currency_code: plan.currency_code,
        payment_context: 'listing_publication',
        proof_url: null,
        payload_json: {
          plan_code: plan.code,
          plan_name: plan.name,
        },
        paid_at: null,
        validated_by_admin_user_id: null,
        validated_at: null,
        validation_notes: null,
      }),
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(plan.amount) * 100),
      currency: plan.currency_code.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      description: `Marketplace publication for ${partner.name}`,
      metadata: {
        tenant_id: String(user.tenant_id),
        partner_id: String(partnerId),
        subscription_id: String(subscription.id),
        listing_payment_id: String(payment.id),
        plan_code: plan.code,
      },
      receipt_email: user.email ?? partner.email ?? undefined,
    });

    payment.provider_ref = paymentIntent.id;
    payment.payload_json = {
      ...(payment.payload_json ?? {}),
      payment_intent_id: paymentIntent.id,
    };
    await this.paymentsRepo.save(payment);

    await this.syncPartnerBillingState(partnerId, {
      subscriptionStatus: 'pending_payment',
      paymentStatus: 'pending',
      planCode: plan.code,
    });

    return {
      subscription_id: subscription.id,
      payment_id: payment.id,
      client_secret: paymentIntent.client_secret,
      publishable_key: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? null,
      amount: plan.amount,
      currency_code: plan.currency_code,
      plan,
    };
  }

  private async applyStripePaymentState(paymentIntent: Stripe.PaymentIntent) {
    const paymentId = paymentIntent.metadata?.listing_payment_id;
    if (!paymentId) {
      return { received: true };
    }

    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      return { received: true };
    }

    const subscription = await this.subscriptionsRepo.findOne({ where: { id: payment.subscription_id } });
    if (!subscription) {
      return { received: true };
    }

    const nextPayload = {
      ...(payment.payload_json ?? {}),
      stripe_status: paymentIntent.status,
      last_sync_at: new Date().toISOString(),
    } as Record<string, any>;

    if (paymentIntent.status === 'succeeded') {
      payment.status = 'paid';
      payment.paid_at = new Date();
      payment.payload_json = nextPayload;
      await this.paymentsRepo.save(payment);

      subscription.status = 'pending_validation';
      await this.subscriptionsRepo.save(subscription);

      await this.syncPartnerBillingState(payment.partner_id, {
        subscriptionStatus: 'pending_validation',
        paymentStatus: 'paid',
        planCode: String(nextPayload.plan_code ?? ''),
      });
      return { received: true };
    }

    if (paymentIntent.status === 'canceled') {
      payment.status = 'cancelled';
      payment.payload_json = nextPayload;
      await this.paymentsRepo.save(payment);
      subscription.status = 'pending_payment';
      await this.subscriptionsRepo.save(subscription);
      await this.syncPartnerBillingState(payment.partner_id, {
        subscriptionStatus: 'pending_payment',
        paymentStatus: 'cancelled',
      });
      return { received: true };
    }

    if (paymentIntent.status === 'requires_payment_method') {
      payment.status = 'failed';
      payment.payload_json = nextPayload;
      await this.paymentsRepo.save(payment);
      subscription.status = 'pending_payment';
      await this.subscriptionsRepo.save(subscription);
      await this.syncPartnerBillingState(payment.partner_id, {
        subscriptionStatus: 'pending_payment',
        paymentStatus: 'failed',
      });
    }

    return { received: true };
  }

  async syncPayment(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId: string | undefined,
    paymentId: string,
  ) {
    const stripe = this.requireStripe();
    const partnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId, partner_id: partnerId } });
    if (!payment) {
      throw new NotFoundException('Listing payment not found');
    }
    if (!payment.provider_ref) {
      throw new BadRequestException('Listing payment is missing Stripe reference');
    }

    const intent = await stripe.paymentIntents.retrieve(payment.provider_ref);
    await this.applyStripePaymentState(intent);
    return this.getMySubscription(user, requestedPartnerId);
  }

  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined, payload: any) {
    let event = payload as Stripe.Event;

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (webhookSecret && rawBody && signature) {
      const stripe = this.requireStripe();
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    }

    const type = event?.type;
    const paymentIntent = event?.data?.object as Stripe.PaymentIntent | undefined;

    if (!paymentIntent || paymentIntent.object !== 'payment_intent') {
      return { received: true };
    }

    if (
      type === 'payment_intent.succeeded' ||
      type === 'payment_intent.payment_failed' ||
      type === 'payment_intent.canceled'
    ) {
      return this.applyStripePaymentState(paymentIntent);
    }

    return { received: true };
  }

  async getAdminPayments(tenantId: string, filters: { status?: string; page?: number; limit?: number }) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);

    const qb = this.paymentsRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.partner', 'partner')
      .leftJoinAndSelect('payment.subscription', 'subscription')
      .leftJoinAndSelect('subscription.plan', 'plan')
      .leftJoinAndSelect('payment.validated_by_admin_user', 'adminUser')
      .where('payment.tenant_id = :tenantId', { tenantId })
      .orderBy('payment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status && filters.status !== 'all') {
      qb.andWhere('payment.status = :status', { status: filters.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async updateAdminPaymentStatus(
    tenantId: string,
    adminUserId: string,
    paymentId: string,
    status: 'validated' | 'rejected',
    notes?: string,
  ) {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId, tenant_id: tenantId } });
    if (!payment) {
      throw new NotFoundException('Listing payment not found');
    }

    const subscription = await this.subscriptionsRepo.findOne({ where: { id: payment.subscription_id } });
    if (!subscription) {
      throw new NotFoundException('Listing subscription not found');
    }

    payment.status = status;
    payment.validated_by_admin_user_id = adminUserId;
    payment.validated_at = new Date();
    payment.validation_notes = notes ?? null;
    await this.paymentsRepo.save(payment);

    if (status === 'validated') {
      subscription.status = 'active';
      subscription.starts_at = new Date();
      subscription.expires_at = null;
      subscription.activated_by_admin_user_id = adminUserId;
      subscription.activated_at = new Date();
      subscription.notes = notes ?? null;
      await this.subscriptionsRepo.save(subscription);
      const plan = await this.plansRepo.findOne({ where: { id: subscription.plan_id } });
      await this.syncPartnerBillingState(payment.partner_id, {
        subscriptionStatus: 'active',
        paymentStatus: 'validated',
        planCode: plan?.code,
      });
    } else {
      subscription.status = 'pending_payment';
      subscription.notes = notes ?? null;
      await this.subscriptionsRepo.save(subscription);
      const plan = await this.plansRepo.findOne({ where: { id: subscription.plan_id } });
      await this.syncPartnerBillingState(payment.partner_id, {
        subscriptionStatus: 'pending_payment',
        paymentStatus: 'rejected',
        planCode: plan?.code,
      });
    }

    return { payment, subscription };
  }
}
