import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';
import { ReportesService } from '../reportes/reportes.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';

@Injectable()
export class ObrasService {
  constructor(
    @InjectRepository(BimObra)
    private readonly obrasRepo: Repository<BimObra>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestosRepo: Repository<BimPresupuesto>,
    private readonly reportesService: ReportesService,
    private readonly presupuestosService: PresupuestosService,
  ) {}

  async create(
    dto: CreateObraDto,
    userId: string,
    tenantId: string,
  ): Promise<BimObra> {
    const codigo = dto.codigo?.trim() || (await this.generateCodigo(tenantId));

    const exists = await this.findAnyByCodigo(codigo, tenantId);
    if (exists) {
      throw new ConflictException(
        `Ya existe una obra con el código "${codigo}"`,
      );
    }

    const obra = this.obrasRepo.create({
      ...dto,
      codigo,
      tenant_id: tenantId,
      created_by: userId,
    });
    return this.obrasRepo.save(obra);
  }

  async findAll(tenantId: string, estado?: string): Promise<BimObra[]> {
    const where: any = { deleted_at: IsNull(), tenant_id: tenantId };
    if (estado) where.estado = estado;

    return this.obrasRepo.find({
      where,
      relations: ['responsable'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<BimObra> {
    const obra = await this.obrasRepo.findOne({
      where: { id, tenant_id: tenantId, deleted_at: IsNull() },
      relations: ['responsable', 'creator'],
    });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateObraDto,
  ): Promise<BimObra> {
    const obra = await this.findOne(id, tenantId);
    const prevMeta = JSON.stringify(obra.meta_json ?? {});

    if (dto.codigo && dto.codigo !== obra.codigo) {
      const duplicate = await this.findAnyByCodigo(dto.codigo, tenantId);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Ya existe una obra con el código "${dto.codigo}"`,
        );
      }
    }

    Object.assign(obra, dto);
    const saved = await this.obrasRepo.save(obra);

    const nextMeta = JSON.stringify(saved.meta_json ?? {});
    if (prevMeta !== nextMeta) {
      const presupuestos = await this.findObraPresupuestos(saved.id, tenantId);
      for (const presupuesto of presupuestos) {
        await this.presupuestosService.recalcularPartidasConApuPorPresupuesto(
          presupuesto.id,
          tenantId,
        );
      }
    }

    return saved;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const obra = await this.findOne(id, tenantId);
    await this.obrasRepo.softRemove(obra);
  }

  async cerrarObra(
    id: string,
    presupuestoId: string,
    tenantId: string,
  ): Promise<BimObra> {
    const obra = await this.findOne(id, tenantId);
    const cierre = await this.reportesService.getCierre(tenantId, id, presupuestoId);

    if (cierre.resumen.estado_cierre !== 'listo_para_cerrar') {
      throw new BadRequestException(
        'La obra no puede cerrarse todavía porque existen diferencias físicas o económicas.',
      );
    }

    obra.estado = 'finalizada';
    obra.fecha_fin_real = new Date() as unknown as Date;
    return this.obrasRepo.save(obra);
  }

  private async generateCodigo(tenantId: string) {
    const obras = await this.obrasRepo
      .createQueryBuilder('obra')
      .withDeleted()
      .where('obra.tenant_id = :tenantId', { tenantId })
      .select(['obra.codigo'])
      .getMany();

    const lastNumber = obras.reduce((max, obra) => {
      const current = obra.codigo
        ? Number.parseInt(obra.codigo.replace(/\D/g, ''), 10)
        : 0;
      return Number.isFinite(current) ? Math.max(max, current) : max;
    }, 0);

    const nextNumber = lastNumber + 1;

    return `OBR-${String(nextNumber).padStart(5, '0')}`;
  }

  private findAnyByCodigo(codigo: string, tenantId: string) {
    return this.obrasRepo
      .createQueryBuilder('obra')
      .withDeleted()
      .where('obra.tenant_id = :tenantId', { tenantId })
      .andWhere('obra.codigo = :codigo', { codigo })
      .getOne();
  }

  private findObraPresupuestos(obraId: string, tenantId: string) {
    return this.presupuestosRepo.find({
      where: { obra_id: obraId, tenant_id: tenantId },
    });
  }
}
