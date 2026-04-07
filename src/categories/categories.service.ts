import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductPublicCategory } from '../database/entities/catalog/product-public-category.entity';
import { WebsiteFilter } from '../database/entities/catalog/website-filter.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateFilterDto } from './dto/create-filter.dto';
import { UpdateFilterDto } from './dto/update-filter.dto';
import { slugify } from '../common/utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ProductPublicCategory)
    private catRepo: Repository<ProductPublicCategory>,
    @InjectRepository(WebsiteFilter)
    private filterRepo: Repository<WebsiteFilter>,
  ) {}

  create(tenantId: string, dto: CreateCategoryDto) {
    const slug = dto.slug ?? slugify(dto.name);
    return this.catRepo.save(
      this.catRepo.create({
        tenant_id: tenantId,
        vertical_type: dto.vertical_type,
        parent_id: dto.parent_id ?? null,
        name: dto.name,
        slug,
        sequence: dto.sequence ?? 10,
        description: dto.description ?? null,
        image_url: dto.image_url ?? null,
        meta_title: dto.meta_title ?? null,
        meta_description: dto.meta_description ?? null,
        meta_keywords: dto.meta_keywords ?? null,
      }),
    );
  }

  findAll(tenantId: string, vertical?: string, parent_id?: string) {
    const where: Record<string, any> = { tenant_id: tenantId, active: 1 };
    if (vertical) where.vertical_type = vertical;
    if (parent_id) where.parent_id = parent_id;
    return this.catRepo.find({
      where,
      order: { sequence: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    await this.catRepo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.catRepo.update(id, { active: 0 });
    return { message: 'Category deactivated' };
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  async createFilter(
    tenantId: string,
    categoryId: string,
    dto: CreateFilterDto,
  ) {
    await this.findOne(categoryId);
    return this.filterRepo.save(
      this.filterRepo.create({
        tenant_id: tenantId,
        category_id: categoryId,
        name: dto.name,
        filter_type: dto.filter_type,
        config_json: dto.config_json ?? null,
        sequence: dto.sequence ?? 10,
      }),
    );
  }

  getFilters(categoryId: string) {
    return this.filterRepo.find({
      where: { category_id: categoryId, is_active: 1 },
      order: { sequence: 'ASC' },
    });
  }

  async updateFilter(filterId: string, dto: UpdateFilterDto) {
    const f = await this.filterRepo.findOne({ where: { id: filterId } });
    if (!f) throw new NotFoundException('Filter not found');
    await this.filterRepo.update(filterId, dto as any);
    return this.filterRepo.findOne({ where: { id: filterId } });
  }

  async removeFilter(filterId: string) {
    const f = await this.filterRepo.findOne({ where: { id: filterId } });
    if (!f) throw new NotFoundException('Filter not found');
    await this.filterRepo.update(filterId, { is_active: 0 });
    return { message: 'Filter deactivated' };
  }
}
