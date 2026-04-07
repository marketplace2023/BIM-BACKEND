import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');

function ensureProductUploadDir() {
  if (!existsSync(PRODUCT_UPLOAD_DIR)) {
    mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
  }
}

function normalizeImageExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return extension || '.jpg';
}

function buildUploadUrl(req: Request, fileName: string) {
  return `${req.protocol}://${req.get('host')}/uploads/products/${fileName}`;
}

@Controller('products')
export class ProductsController {
  constructor(private svc: ProductsService) {}

  /** POST /api/products/upload-images */
  @UseGuards(JwtAuthGuard)
  @Post('upload-images')
  @HttpCode(201)
  @UseInterceptors(
    FilesInterceptor('files', 8, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureProductUploadDir();
          cb(null, PRODUCT_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${normalizeImageExtension(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        cb(isImage ? null : new Error('Only image uploads are allowed'), isImage);
      },
      limits: {
        files: 8,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadImages(
    @UploadedFiles() files: Array<{
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
    }>,
    @Req() req: Request,
  ) {
    return {
      data: (files ?? []).map((file) => ({
        name: file.filename,
        originalName: file.originalname,
        url: buildUploadUrl(req, file.filename),
        mimeType: file.mimetype,
        size: file.size,
      })),
    };
  }

  /** PATCH /api/products/:id/images */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/images')
  syncImages(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Body()
    dto: {
      images?: Array<{
        url: string;
        fileName?: string;
        originalName?: string;
        mimeType?: string;
        size?: number;
      isCover?: boolean;
      sortOrder?: number;
      }>;
    },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.syncImages(id, user, dto.images ?? [], storeContextId);
  }

  /** POST /api/products */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Body() dto: CreateProductDto,
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.create(user, dto, storeContextId);
  }

  /** GET /api/products?vertical=contractor&categ_id=&q=plomero&min_price=50&max_price=500&page=1&limit=20 */
  @Get()
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('vertical') vertical?: string,
    @Query('categ_id') categ_id?: string,
    @Query('partner_id') partner_id?: string,
    @Query('q') q?: string,
    @Query('min_price') min_price?: number,
    @Query('max_price') max_price?: number,
    @Query('published') published?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findAll(tenantId, {
      vertical,
      categ_id,
      partner_id,
      q,
      min_price,
      max_price,
      published,
      page,
      limit,
    });
  }

  /** GET /api/products/inventory/hardware */
  @UseGuards(JwtAuthGuard)
  @Get('inventory/hardware')
  getHardwareInventory(
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.getInventory(user, storeContextId);
  }

  /** GET /api/products/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  /** PATCH /api/products/:id */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Body() dto: UpdateProductDto,
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.update(id, user, dto, storeContextId);
  }

  /** DELETE /api/products/:id */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.remove(id, user, storeContextId);
  }

  /** PATCH /api/products/:id/publish */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.setPublished(id, user, true, storeContextId);
  }

  /** PATCH /api/products/:id/unpublish */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/unpublish')
  unpublish(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email?: string; tenant_id: string; partner_id: string },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.svc.setPublished(id, user, false, storeContextId);
  }
}
