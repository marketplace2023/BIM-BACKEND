import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StorePaymentMethodsService } from '../store-payment-methods/store-payment-methods.service';

const STORE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'stores');

function ensureStoreUploadDir() {
  if (!existsSync(STORE_UPLOAD_DIR)) {
    mkdirSync(STORE_UPLOAD_DIR, { recursive: true });
  }
}

function normalizeImageExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return extension || '.jpg';
}

function buildUploadUrl(req: Request, fileName: string) {
  return `${req.protocol}://${req.get('host')}/uploads/stores/${fileName}`;
}

@Controller('stores')
export class StoresController {
  constructor(
    private svc: StoresService,
    private readonly storePaymentMethodsService: StorePaymentMethodsService,
  ) {}

  /** POST /api/stores — Create store + vertical profile */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { tenant_id: string },
    @Body() dto: CreateStoreDto,
  ) {
    return this.svc.create(user.tenant_id, dto);
  }

  /** POST /api/stores/upload-logo */
  @UseGuards(JwtAuthGuard)
  @Post('upload-logo')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureStoreUploadDir();
          cb(null, STORE_UPLOAD_DIR);
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
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadLogo(
    @UploadedFile()
    file: {
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Req() req: Request,
  ) {
    return {
      data: {
        name: file.filename,
        originalName: file.originalname,
        url: buildUploadUrl(req, file.filename),
        mimeType: file.mimetype,
        size: file.size,
      },
    };
  }

  /** POST /api/stores/upload-images */
  @UseGuards(JwtAuthGuard)
  @Post('upload-images')
  @HttpCode(201)
  @UseInterceptors(
    FilesInterceptor('files', 8, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureStoreUploadDir();
          cb(null, STORE_UPLOAD_DIR);
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
    @UploadedFiles()
    files: Array<{
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

  /** GET /api/stores/public?vertical=hardware_store&page=1&limit=20 */
  @Get('public')
  findPublic(
    @Query('vertical') vertical?: string,
    @Query('city') city?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findPublic({ vertical, city, page, limit });
  }

  /** GET /api/stores/public/:id */
  @Get('public/:id')
  findPublicOne(@Param('id') id: string) {
    return this.svc.findPublicOne(id);
  }

  /** GET /api/stores/public/:id/products */
  @Get('public/:id/products')
  getPublicProducts(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getPublicStoreProducts(id, page, limit);
  }

  /** GET /api/stores/public/:id/ratings */
  @Get('public/:id/ratings')
  getPublicRatings(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getPublicStoreRatings(id, page, limit);
  }

  /** GET /api/stores/public/:id/payment-methods */
  @Get('public/:id/payment-methods')
  getPublicPaymentMethods(@Param('id') id: string) {
    return this.storePaymentMethodsService.findPublic(id);
  }

  /** GET /api/stores?vertical=contractor&city=Miami&verified=true&page=1&limit=20 */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @CurrentUser() user: { tenant_id: string },
    @Query('vertical') vertical?: string,
    @Query('city') city?: string,
    @Query('verified') verified?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findAll(user.tenant_id, {
      vertical,
      city,
      verified,
      page,
      limit,
    });
  }

  /** GET /api/stores/:id */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  /** PATCH /api/stores/:id */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.svc.update(id, dto);
  }

  /** GET /api/stores/:id/products */
  @UseGuards(JwtAuthGuard)
  @Get(':id/products')
  getProducts(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getStoreProducts(id, page, limit);
  }

  /** GET /api/stores/:id/ratings */
  @UseGuards(JwtAuthGuard)
  @Get(':id/ratings')
  getRatings(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getStoreRatings(id, page, limit);
  }
}
