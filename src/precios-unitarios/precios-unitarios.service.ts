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
  async createRecurso(dto: CreateRecursoDto): Promise<BimRecurso> {
    const exists = await this.recursoRepo.findOneBy({ codigo: dto.codigo });
    if (exists)
      throw new ConflictException(
        `Código de recurso "${dto.codigo}" ya existe`,
      );
    return this.recursoRepo.save(this.recursoRepo.create(dto));
  }

  async findRecursos(tipo?: string): Promise<BimRecurso[]> {
    const where: any = { activo: 1 };
    if (tipo) where.tipo = tipo;
    return this.recursoRepo.find({ where, order: { descripcion: 'ASC' } });
  }

  async updateRecurso(id: string, dto: UpdateRecursoDto): Promise<BimRecurso> {
    const r = await this.recursoRepo.findOneBy({ id });
    if (!r) throw new NotFoundException(`Recurso #${id} no encontrado`);
    Object.assign(r, dto);
    return this.recursoRepo.save(r);
  }

  async removeRecurso(id: string): Promise<void> {
    const r = await this.recursoRepo.findOneBy({ id });
    if (!r) throw new NotFoundException(`Recurso #${id} no encontrado`);
    r.activo = 0;
    await this.recursoRepo.save(r);
  }

  // ── Precios Unitarios ───────────────────────────────────
  async createPU(dto: CreatePrecioUnitarioDto): Promise<BimPrecioUnitario> {
    const exists = await this.puRepo.findOneBy({ codigo: dto.codigo });
    if (exists)
      throw new ConflictException(`Código APU "${dto.codigo}" ya existe`);
    const pu = this.puRepo.create({ ...dto, precio_base: '0' });
    return this.puRepo.save(pu);
  }

  async findPUs(categoria?: string): Promise<BimPrecioUnitario[]> {
    const where: any = { activo: 1 };
    if (categoria) where.categoria = categoria;
    return this.puRepo.find({ where, order: { codigo: 'ASC' } });
  }

  async findOnePU(
    id: string,
  ): Promise<BimPrecioUnitario & { descomposicion: BimApuDescomposicion[] }> {
    const pu = await this.puRepo.findOneBy({ id });
    if (!pu) throw new NotFoundException(`APU #${id} no encontrado`);
    const descomposicion = await this.decompRepo.find({
      where: { precio_unitario_id: id },
      relations: ['recurso'],
      order: { orden: 'ASC' },
    });
    return { ...pu, descomposicion };
  }

  async updatePU(
    id: string,
    dto: UpdatePrecioUnitarioDto,
  ): Promise<BimPrecioUnitario> {
    const pu = await this.puRepo.findOneBy({ id });
    if (!pu) throw new NotFoundException(`APU #${id} no encontrado`);
    Object.assign(pu, dto);
    return this.puRepo.save(pu);
  }

  async removePU(id: string): Promise<void> {
    const pu = await this.puRepo.findOneBy({ id });
    if (!pu) throw new NotFoundException(`APU #${id} no encontrado`);
    pu.activo = 0;
    await this.puRepo.save(pu);
  }

  // ── Descomposición ──────────────────────────────────────
  async addDescomposicion(
    puId: string,
    dto: CreateDescomposicionDto,
  ): Promise<BimApuDescomposicion> {
    await this.findOnePU(puId);
    const item = this.decompRepo.create({ precio_unitario_id: puId, ...dto });
    const saved = await this.decompRepo.save(item);
    await this.recalcularPrecioBase(puId);
    return saved;
  }

  async updateDescomposicion(
    id: string,
    dto: UpdateDescomposicionDto,
  ): Promise<BimApuDescomposicion> {
    const item = await this.decompRepo.findOneBy({ id });
    if (!item) throw new NotFoundException(`Línea APU #${id} no encontrada`);
    Object.assign(item, dto);
    const saved = await this.decompRepo.save(item);
    await this.recalcularPrecioBase(item.precio_unitario_id);
    return saved;
  }

  async removeDescomposicion(id: string): Promise<void> {
    const item = await this.decompRepo.findOneBy({ id });
    if (!item) throw new NotFoundException(`Línea APU #${id} no encontrada`);
    const puId = item.precio_unitario_id;
    await this.decompRepo.remove(item);
    await this.recalcularPrecioBase(puId);
  }

  // Recalcula precio_base = SUM(importe_total) / rendimiento
  private async recalcularPrecioBase(puId: string): Promise<void> {
    const result = await this.decompRepo
      .createQueryBuilder('d')
      .where('d.precio_unitario_id = :puId', { puId })
      .select('SUM(d.importe_total)', 'total')
      .getRawOne<{ total: string }>();

    const total = parseFloat(result?.total ?? '0');
    const pu = await this.puRepo.findOneBy({ id: puId });
    if (!pu) return;
    const rendimiento = parseFloat(pu.rendimiento) || 1;
    pu.precio_base = (total / rendimiento).toFixed(4);
    await this.puRepo.save(pu);
  }
}
