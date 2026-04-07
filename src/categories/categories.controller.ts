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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateFilterDto } from './dto/create-filter.dto';
import { UpdateFilterDto } from './dto/update-filter.dto';

const CATEGORY_UPLOAD_DIR = join(process.cwd(), 'uploads', 'categories');

function ensureCategoryUploadDir() {
  if (!existsSync(CATEGORY_UPLOAD_DIR)) {
    mkdirSync(CATEGORY_UPLOAD_DIR, { recursive: true });
  }
}

function normalizeImageExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return extension || '.jpg';
}

function buildUploadUrl(req: Request, fileName: string) {
  return `${req.protocol}://${req.get('host')}/uploads/categories/${fileName}`;
}

@Controller('categories')
export class CategoriesController {
  constructor(private svc: CategoriesService) {}

  /** POST /api/categories */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  create(
    @CurrentUser() user: { tenant_id: string },
    @Body() dto: CreateCategoryDto,
  ) {
    return this.svc.create(user.tenant_id, dto);
  }

  /** POST /api/categories/upload-image */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('upload-image')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureCategoryUploadDir();
          cb(null, CATEGORY_UPLOAD_DIR);
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
  uploadImage(
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

  /** GET /api/categories?vertical=contractor&parent_id= */
  @Get()
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('vertical') vertical?: string,
    @Query('parent_id') parent_id?: string,
  ) {
    return this.svc.findAll(tenantId, vertical, parent_id);
  }

  /** GET /api/categories/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  /** PATCH /api/categories/:id */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.update(id, dto);
  }

  /** DELETE /api/categories/:id */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // ── Filters ──────────────────────────────────────────────────────────

  /** POST /api/categories/:id/filters */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post(':id/filters')
  createFilter(
    @CurrentUser() user: { tenant_id: string },
    @Param('id') categoryId: string,
    @Body() dto: CreateFilterDto,
  ) {
    return this.svc.createFilter(user.tenant_id, categoryId, dto);
  }

  /** GET /api/categories/:id/filters */
  @Get(':id/filters')
  getFilters(@Param('id') categoryId: string) {
    return this.svc.getFilters(categoryId);
  }

  /** PATCH /api/categories/:id/filters/:filterId */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id/filters/:filterId')
  updateFilter(
    @Param('filterId') filterId: string,
    @Body() dto: UpdateFilterDto,
  ) {
    return this.svc.updateFilter(filterId, dto);
  }

  /** DELETE /api/categories/:id/filters/:filterId */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id/filters/:filterId')
  removeFilter(@Param('filterId') filterId: string) {
    return this.svc.removeFilter(filterId);
  }
}
