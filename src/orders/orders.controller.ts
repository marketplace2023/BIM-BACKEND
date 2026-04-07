import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SelectOrderPaymentMethodDto } from './dto/select-order-payment-method.dto';
import { SubmitOrderPaymentProofDto } from './dto/submit-order-payment-proof.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderPaymentStatusDto } from './dto/update-order-payment-status.dto';

const PAYMENT_PROOF_UPLOAD_DIR = join(process.cwd(), 'uploads', 'payment-proofs');

function ensurePaymentProofUploadDir() {
  if (!existsSync(PAYMENT_PROOF_UPLOAD_DIR)) {
    mkdirSync(PAYMENT_PROOF_UPLOAD_DIR, { recursive: true });
  }
}

function normalizePaymentProofExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return extension || '.jpg';
}

function buildPaymentProofUrl(req: Request, fileName: string) {
  return `${req.protocol}://${req.get('host')}/uploads/payment-proofs/${fileName}`;
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private svc: OrdersService) {}

  /** POST /api/orders */
  @Post()
  create(
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: CreateOrderDto,
  ) {
    return this.svc.create(user.tenant_id, user.partner_id, dto);
  }

  /** GET /api/orders?page=1&limit=20 */
  @Get()
  findAll(
    @CurrentUser() user: { partner_id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findMyOrders(user.partner_id, page, limit);
  }

  /** GET /api/orders/store?vertical_type=hardware_store&page=1&limit=20 */
  @Get('store')
  findStoreOrders(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId?: string,
    @Query('vertical_type') verticalType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findStoreOrders(user, storeContextId, verticalType, page, limit);
  }

  /** GET /api/orders/education/enrollments?page=1&limit=20 */
  @Get('education/enrollments')
  findEducationEnrollments(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findEducationEnrollments(user, storeContextId, page, limit);
  }

  /** GET /api/orders/:id */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { partner_id: string },
  ) {
    return this.svc.findOne(id, user.partner_id);
  }

  /** PATCH /api/orders/:id/status */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { partner_id: string },
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.svc.updateStatus(id, user.partner_id, dto);
  }

  /** PATCH /api/orders/:id/payment-method */
  @Patch(':id/payment-method')
  selectPaymentMethod(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: SelectOrderPaymentMethodDto,
  ) {
    return this.svc.selectPaymentMethod(id, user, dto);
  }

  /** PATCH /api/orders/:id/payment-proof */
  @Patch(':id/payment-proof')
  submitPaymentProof(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: SubmitOrderPaymentProofDto,
  ) {
    return this.svc.submitPaymentProof(id, user, dto);
  }

  /** PATCH /api/orders/:id/payment-status */
  @Patch(':id/payment-status')
  updatePaymentStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() dto: UpdateOrderPaymentStatusDto,
  ) {
    return this.svc.updatePaymentStatus(id, user, storeContextId, dto);
  }

  /** POST /api/orders/upload-payment-proof */
  @Post('upload-payment-proof')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensurePaymentProofUploadDir();
          cb(null, PAYMENT_PROOF_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${normalizePaymentProofExtension(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
        cb(allowed ? null : new Error('Only image or PDF uploads are allowed'), allowed);
      },
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  uploadPaymentProof(@UploadedFile() file: any, @Req() req: Request) {
    return {
      data: {
        name: file.filename,
        originalName: file.originalname,
        url: buildPaymentProofUrl(req, file.filename),
        mimeType: file.mimetype,
        size: file.size,
      },
    };
  }
}
