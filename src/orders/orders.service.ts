import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { SaleOrderLine } from '../database/entities/commerce/sale-order-line.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { StorePaymentMethod } from '../database/entities/payments/store-payment-method.entity';
import { Course } from '../database/entities/verticals/course.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { SelectOrderPaymentMethodDto } from './dto/select-order-payment-method.dto';
import { SubmitOrderPaymentProofDto } from './dto/submit-order-payment-proof.dto';
import { UpdateOrderPaymentStatusDto } from './dto/update-order-payment-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(SaleOrder) private ordersRepo: Repository<SaleOrder>,
    @InjectRepository(SaleOrderLine)
    private linesRepo: Repository<SaleOrderLine>,
    @InjectRepository(ProductTemplate)
    private productsRepo: Repository<ProductTemplate>,
    @InjectRepository(ResPartner)
    private partnersRepo: Repository<ResPartner>,
    @InjectRepository(StorePaymentMethod)
    private paymentMethodsRepo: Repository<StorePaymentMethod>,
    @InjectRepository(Course)
    private coursesRepo: Repository<Course>,
  ) {}

  private async resolveManagedPartnerId(user: {
    tenant_id: string;
    partner_id: string;
    email?: string;
  }, requestedPartnerId?: string) {
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

  private parseMeta(value: unknown) {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, any>;
      } catch {
        return null;
      }
    }

    if (typeof value === 'object') {
      return value as Record<string, any>;
    }

    return null;
  }

  async create(tenantId: string, partnerId: string, dto: CreateOrderDto) {
    let amountUntaxed = 0;
    for (const line of dto.lines) {
      const discount = line.discount ?? 0;
      amountUntaxed += line.qty * line.price_unit * (1 - discount / 100);
    }

    const order = await this.ordersRepo.save(
      this.ordersRepo.create({
        tenant_id: tenantId,
        partner_id: partnerId,
        x_professional_id: dto.professional_id ?? null,
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
        currency_code: dto.currency_code ?? 'USD',
        amount_untaxed: amountUntaxed.toFixed(2),
        amount_tax: '0.00',
        amount_total: amountUntaxed.toFixed(2),
        meta_json: dto.meta_json ?? null,
      }),
    );

    for (const line of dto.lines) {
      const discount = line.discount ?? 0;
      const subtotal = line.qty * line.price_unit * (1 - discount / 100);
      await this.linesRepo.save(
        this.linesRepo.create({
          order_id: order.id,
          product_tmpl_id: line.product_tmpl_id,
          product_variant_id: line.product_variant_id ?? null,
          name: line.name,
          qty: String(line.qty),
          price_unit: String(line.price_unit),
          discount: String(discount),
          subtotal: subtotal.toFixed(2),
          line_meta_json: line.line_meta_json ?? null,
        }),
      );
    }

    return this._loadWithLines(order.id);
  }

  async findMyOrders(partnerId: string, page = 1, limit = 20) {
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .where('o.partner_id = :pid OR o.x_professional_id = :pid', {
        pid: partnerId,
      })
      .orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    const hydrated = await Promise.all(data.map((order) => this._loadWithLines(order.id)));
    return { data: hydrated, total, page, limit };
  }

  async findStoreOrders(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
    verticalType?: string,
    page = 1,
    limit = 20,
  ) {
    const partnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);

    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .innerJoin(SaleOrderLine, 'line', 'line.order_id = o.id')
      .innerJoin(ProductTemplate, 'product', 'product.id = line.product_tmpl_id')
      .where('o.tenant_id = :tenantId', { tenantId: user.tenant_id })
      .andWhere('product.partner_id = :partnerId', { partnerId })
      .andWhere('product.deleted_at IS NULL')
      .orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .distinct(true);

    if (verticalType) {
      qb.andWhere('product.vertical_type = :verticalType', { verticalType });
    }

    const [data, total] = await qb.getManyAndCount();
    const hydrated = await Promise.all(data.map((order) => this._loadWithLines(order.id)));
    return { data: hydrated, total, page, limit };
  }

  async findEducationEnrollments(
    user: { tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId?: string,
    page = 1,
    limit = 20,
  ) {
    const partnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);

    const qb = this.linesRepo
      .createQueryBuilder('line')
      .innerJoin(SaleOrder, 'order', 'order.id = line.order_id')
      .innerJoin(ProductTemplate, 'product', 'product.id = line.product_tmpl_id')
      .leftJoin(Course, 'course', 'course.product_tmpl_id = product.id')
      .leftJoin(ResPartner, 'student', 'student.id = order.partner_id')
      .leftJoin(StorePaymentMethod, 'payment_method', 'payment_method.id = order.payment_method_id')
      .where('product.partner_id = :partnerId', { partnerId })
      .andWhere('product.vertical_type = :verticalType', {
        verticalType: 'education_provider',
      })
      .andWhere('product.deleted_at IS NULL')
      .orderBy('order.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'line.id AS line_id',
        'line.name AS line_name',
        'line.qty AS line_qty',
        'line.price_unit AS line_price_unit',
        'line.subtotal AS line_subtotal',
        'line.line_meta_json AS line_meta_json',
        'order.id AS order_id',
        'order.order_number AS order_number',
        'order.status AS order_status',
        'order.payment_status AS payment_status',
        'order.payment_method_id AS payment_method_id',
        'order.payment_reference AS payment_reference',
        'order.payment_proof_url AS payment_proof_url',
        'order.payment_notes AS payment_notes',
        'payment_method.title AS payment_method_title',
        'order.currency_code AS currency_code',
        'order.created_at AS order_created_at',
        'order.meta_json AS order_meta_json',
        'student.id AS student_id',
        'student.name AS student_name',
        'student.email AS student_email',
        'product.id AS product_id',
        'product.name AS product_name',
        'product.cover_image_url AS cover_image_url',
        'course.course_mode AS course_mode',
        'course.duration_hours AS duration_hours',
        'course.certificate_available AS certificate_available',
      ]);

    const countQb = qb.clone();
    const [rows, total] = await Promise.all([qb.getRawMany(), countQb.getCount()]);

    return {
      data: rows.map((row) => {
        const lineMeta = this.parseMeta(row.line_meta_json);
        const orderMeta = this.parseMeta(row.order_meta_json);

        return {
          id: String(row.line_id),
          order_id: String(row.order_id),
          order_number: String(row.order_number),
          status: String(row.order_status),
          payment_status: String(row.payment_status ?? 'unpaid'),
          payment_method_id: row.payment_method_id ? String(row.payment_method_id) : null,
          payment_reference: row.payment_reference ? String(row.payment_reference) : null,
          payment_proof_url: row.payment_proof_url ? String(row.payment_proof_url) : null,
          payment_notes: row.payment_notes ? String(row.payment_notes) : null,
          payment_method_title: row.payment_method_title ? String(row.payment_method_title) : null,
          created_at: row.order_created_at,
          start_date:
            (typeof lineMeta?.start_date === 'string' && lineMeta.start_date) ||
            (typeof orderMeta?.start_date === 'string' && orderMeta.start_date) ||
            null,
          student: {
            id: row.student_id ? String(row.student_id) : null,
            name: row.student_name ? String(row.student_name) : 'Estudiante sin nombre',
            email: row.student_email ? String(row.student_email) : null,
          },
          course: {
            id: String(row.product_id),
            name: String(row.product_name),
            cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
            course_mode: row.course_mode ? String(row.course_mode) : null,
            duration_hours: row.duration_hours ? String(row.duration_hours) : null,
            certificate_available: Boolean(row.certificate_available),
          },
          qty: Number(row.line_qty ?? 0),
          price_unit: String(row.line_price_unit ?? '0'),
          total: String(row.line_subtotal ?? '0'),
          currency_code: String(row.currency_code ?? 'USD'),
        };
      }),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, partnerId: string) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.partner_id !== partnerId &&
      order.x_professional_id !== partnerId
    ) {
      throw new ForbiddenException('Access denied');
    }
    return this._loadWithLines(id);
  }

  async updateStatus(id: string, partnerId: string, dto: UpdateOrderStatusDto) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.partner_id !== partnerId &&
      order.x_professional_id !== partnerId
    ) {
      throw new ForbiddenException('Access denied');
    }
    await this.ordersRepo.update(id, { status: dto.status });
    return this._loadWithLines(id);
  }

  async selectPaymentMethod(
    id: string,
    user: { tenant_id: string; partner_id: string },
    dto: SelectOrderPaymentMethodDto,
  ) {
    const order = await this.ordersRepo.findOne({ where: { id, tenant_id: user.tenant_id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.partner_id !== user.partner_id) throw new ForbiddenException('Access denied');

    const method = await this.paymentMethodsRepo.findOne({
      where: {
        id: dto.payment_method_id,
        tenant_id: user.tenant_id,
        partner_id: order.x_professional_id ?? '0',
        is_enabled: 1,
      },
    });
    if (!method) throw new NotFoundException('Store payment method not found');

    order.payment_method_id = method.id;
    order.payment_status = 'pending_proof';
    await this.ordersRepo.save(order);
    return this._loadWithLines(order.id);
  }

  async submitPaymentProof(
    id: string,
    user: { tenant_id: string; partner_id: string },
    dto: SubmitOrderPaymentProofDto,
  ) {
    const order = await this.ordersRepo.findOne({ where: { id, tenant_id: user.tenant_id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.partner_id !== user.partner_id) throw new ForbiddenException('Access denied');
    if (!order.payment_method_id) throw new ForbiddenException('Select a payment method first');

    order.payment_reference = dto.payment_reference ?? null;
    order.payment_proof_url = dto.payment_proof_url ?? null;
    order.payment_notes = dto.payment_notes ?? null;
    order.payment_status = 'pending_validation';
    await this.ordersRepo.save(order);
    return this._loadWithLines(order.id);
  }

  async updatePaymentStatus(
    id: string,
    user: { id: string; tenant_id: string; partner_id: string; email?: string },
    requestedPartnerId: string | undefined,
    dto: UpdateOrderPaymentStatusDto,
  ) {
    const managedPartnerId = await this.resolveManagedPartnerId(user, requestedPartnerId);
    const order = await this.ordersRepo.findOne({ where: { id, tenant_id: user.tenant_id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.x_professional_id !== managedPartnerId) throw new ForbiddenException('Access denied');

    order.payment_status = dto.payment_status;
    if (dto.payment_status === 'paid') {
      order.paid_at = new Date();
    }
    order.validated_by_store_user_id = user.id;
    order.validated_at = new Date();
    await this.ordersRepo.save(order);
    return this._loadWithLines(order.id);
  }

  private async _loadWithLines(orderId: string) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['payment_method'],
    });
    const lines = await this.linesRepo.find({ where: { order_id: orderId } });
    return { ...order, lines };
  }
}
