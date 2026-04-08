import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BimPrecioUnitario } from '../database/entities/bim/bim-precio-unitario.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import { BimApuDescomposicion } from '../database/entities/bim/bim-apu-descomposicion.entity';
import {
  CreatePrecioUnitarioDto,
  CreateRecursoDto,
  CreateDescomposicionDto,
} from './dto/create-precio-unitario.dto';
import {
  UpdatePrecioUnitarioDto,
  UpdateRecursoDto,
  UpdateDescomposicionDto,
} from './dto/update-precio-unitario.dto';

@Injectable()
export class PreciosUnitariosService {
  constructor(
    @InjectRepository(BimPrecioUnitario)
    private readonly puRepo: Repository<BimPrecioUnitario>,
    @InjectRepository(BimRecurso)
    private readonly recursoRepo: Repository<BimRecurso>,
    @InjectRepository(BimApuDescomposicion)
    private readonly decompRepo: Repository<BimApuDescomposicion>,
  ) {}

  // ── Recursos ────────────────────────────────────────────
  async createRecurso(
    dto: CreateRecursoDto,
    tenantId: string,
  ): Promise<BimRecurso> {
    const exists = await this.recursoRepo.findOneBy({
      codigo: dto.codigo,
      tenant_id: tenantId,
    });
    if (exists)
      throw new ConflictException(
        `Código de recurso "${dto.codigo}" ya existe`,
      );
    return this.recursoRepo.save(
      this.recursoRepo.create({ ...dto, tenant_id: tenantId }),
    );
  }

  async findRecursos(tenantId: string, tipo?: string): Promise<BimRecurso[]> {
    const where: any = { activo: 1, tenant_id: tenantId };
    if (tipo) where.tipo = tipo;
    return this.recursoRepo.find({ where, order: { descripcion: 'ASC' } });
  }

  async updateRecurso(
    id: string,
    tenantId: string,
    dto: UpdateRecursoDto,
  ): Promise<BimRecurso> {
    const r = await this.findRecurso(id, tenantId);
    Object.assign(r, dto);
    return this.recursoRepo.save(r);
  }

  async removeRecurso(id: string, tenantId: string): Promise<void> {
    const r = await this.findRecurso(id, tenantId);
    r.activo = 0;
    await this.recursoRepo.save(r);
  }

  // ── Precios Unitarios ───────────────────────────────────
  async createPU(
    dto: CreatePrecioUnitarioDto,
    tenantId: string,
  ): Promise<BimPrecioUnitario> {
    const exists = await this.puRepo.findOneBy({
      codigo: dto.codigo,
      tenant_id: tenantId,
    });
    if (exists)
      throw new ConflictException(`Código APU "${dto.codigo}" ya existe`);
    const pu = this.puRepo.create({
      ...dto,
      tenant_id: tenantId,
      precio_base: '0',
    });
    return this.puRepo.save(pu);
  }

  async findPUs(
    tenantId: string,
    categoria?: string,
  ): Promise<BimPrecioUnitario[]> {
    const where: any = { activo: 1, tenant_id: tenantId };
    if (categoria) where.categoria = categoria;
    return this.puRepo.find({ where, order: { codigo: 'ASC' } });
  }

  async findOnePU(
    id: string,
    tenantId: string,
  ): Promise<BimPrecioUnitario & { descomposicion: BimApuDescomposicion[] }> {
    const pu = await this.findPU(id, tenantId);
    const descomposicion = await this.decompRepo.find({
      where: { precio_unitario_id: id },
      relations: ['recurso'],
      order: { orden: 'ASC' },
    });
    return { ...pu, descomposicion };
  }

  async updatePU(
    id: string,
    tenantId: string,
    dto: UpdatePrecioUnitarioDto,
  ): Promise<BimPrecioUnitario> {
    const pu = await this.findPU(id, tenantId);
    Object.assign(pu, dto);
    return this.puRepo.save(pu);
  }

  async removePU(id: string, tenantId: string): Promise<void> {
    const pu = await this.findPU(id, tenantId);
    pu.activo = 0;
    await this.puRepo.save(pu);
  }

  // ── Descomposición ──────────────────────────────────────
  async addDescomposicion(
    puId: string,
    tenantId: string,
    dto: CreateDescomposicionDto,
  ): Promise<BimApuDescomposicion> {
    await this.findOnePU(puId, tenantId);
    await this.findRecurso(dto.recurso_id, tenantId);
    const item = this.decompRepo.create({ precio_unitario_id: puId, ...dto });
    const saved = await this.decompRepo.save(item);
    await this.recalcularPrecioBase(puId, tenantId);
    return saved;
  }

  async updateDescomposicion(
    id: string,
    tenantId: string,
    dto: UpdateDescomposicionDto,
  ): Promise<BimApuDescomposicion> {
    const item = await this.findDescomposicion(id, tenantId);
    Object.assign(item, dto);
    const saved = await this.decompRepo.save(item);
    await this.recalcularPrecioBase(item.precio_unitario_id, tenantId);
    return saved;
  }

  async removeDescomposicion(id: string, tenantId: string): Promise<void> {
    const item = await this.findDescomposicion(id, tenantId);
    const puId = item.precio_unitario_id;
    await this.decompRepo.remove(item);
    await this.recalcularPrecioBase(puId, tenantId);
  }

  // Recalcula precio_base = SUM(importe_total) / rendimiento
  private async recalcularPrecioBase(
    puId: string,
    tenantId: string,
  ): Promise<void> {
    const result = await this.decompRepo
      .createQueryBuilder('d')
      .where('d.precio_unitario_id = :puId', { puId })
      .select('SUM(d.importe_total)', 'total')
      .getRawOne<{ total: string }>();

    const total = parseFloat(result?.total ?? '0');
    const pu = await this.puRepo.findOneBy({ id: puId, tenant_id: tenantId });
    if (!pu) return;
    const rendimiento = parseFloat(pu.rendimiento) || 1;
    pu.precio_base = (total / rendimiento).toFixed(4);
    await this.puRepo.save(pu);
  }

  private async findRecurso(id: string, tenantId: string) {
    const recurso = await this.recursoRepo.findOneBy({ id, tenant_id: tenantId });
    if (!recurso) throw new NotFoundException(`Recurso #${id} no encontrado`);
    return recurso;
  }

  private async findPU(id: string, tenantId: string) {
    const pu = await this.puRepo.findOneBy({ id, tenant_id: tenantId });
    if (!pu) throw new NotFoundException(`APU #${id} no encontrado`);
    return pu;
  }

  private async findDescomposicion(id: string, tenantId: string) {
    const item = await this.decompRepo
      .createQueryBuilder('d')
      .innerJoin(BimPrecioUnitario, 'pu', 'pu.id = d.precio_unitario_id')
      .where('d.id = :id', { id })
      .andWhere('pu.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!item) throw new NotFoundException(`Línea APU #${id} no encontrada`);
    return item;
  }
}
