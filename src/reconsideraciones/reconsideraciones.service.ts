import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateReconsideracionDto } from './dto/create-reconsideracion.dto';
import { UpdateReconsideracionDto } from './dto/update-reconsideracion.dto';
import { ChangeReconsideracionStatusDto } from './dto/change-reconsideracion-status.dto';

@Injectable()
export class ReconsideracionesService {
  constructor(
    @InjectRepository(BimReconsideracion)
    private readonly reconsideracionRepo: Repository<BimReconsideracion>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
  ) {}

  async create(
    dto: CreateReconsideracionDto,
    userId: string,
    tenantId: string,
  ) {
    const obra = await this.findTenantObra(dto.obra_id, tenantId);
    const partida = await this.findTenantPartida(dto.partida_id, tenantId);

    if (partida.obra_id !== obra.id) {
      throw new BadRequestException(
        'La partida no pertenece a la obra seleccionada',
      );
    }

    const original = Number.parseFloat(partida.cantidad ?? '0') || 0;
    const variation = Number.parseFloat(dto.cantidad_variacion ?? '0') || 0;
    const unitPrice = Number.parseFloat(partida.precio_unitario ?? '0') || 0;

    const signedVariation =
      dto.tipo === 'disminucion' ? variation * -1 : variation;
    const newQuantity = original + signedVariation;

    if (newQuantity < 0) {
      throw new BadRequestException('La nueva cantidad no puede ser negativa');
    }

    return this.reconsideracionRepo.save(
      this.reconsideracionRepo.create({
        tenant_id: tenantId,
        obra_id: dto.obra_id,
        partida_id: dto.partida_id,
        tipo: dto.tipo,
        descripcion: dto.descripcion,
        cantidad_original: original.toFixed(4),
        cantidad_variacion: signedVariation.toFixed(4),
        cantidad_nueva: newQuantity.toFixed(4),
        precio_unitario: unitPrice.toFixed(4),
        monto_variacion: (signedVariation * unitPrice).toFixed(2),
        justificacion: dto.justificacion ?? null,
        status: 'borrador',
        created_by: userId,
        approved_by: null,
        approved_at: null,
      }),
    );
  }

  async findByObra(obraId: string, tenantId: string) {
    await this.findTenantObra(obraId, tenantId);
    return this.reconsideracionRepo.find({
      where: { obra_id: obraId, tenant_id: tenantId },
      relations: ['partida', 'creador', 'aprobador'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const rec = await this.reconsideracionRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['partida', 'obra', 'creador', 'aprobador'],
    });

    if (!rec)
      throw new NotFoundException(`Reconsideración #${id} no encontrada`);
    return rec;
  }

  async update(id: string, tenantId: string, dto: UpdateReconsideracionDto) {
    const rec = await this.findOne(id, tenantId);

    if (rec.status !== 'borrador') {
      throw new BadRequestException(
        'Solo puedes editar reconsideraciones en borrador',
      );
    }

    const obraId = dto.obra_id ?? rec.obra_id;
    const partidaId = dto.partida_id ?? rec.partida_id;

    const obra = await this.findTenantObra(obraId, tenantId);
    const partida = await this.findTenantPartida(partidaId, tenantId);

    if (partida.obra_id !== obra.id) {
      throw new BadRequestException(
        'La partida no pertenece a la obra seleccionada',
      );
    }

    const original = Number.parseFloat(partida.cantidad ?? '0') || 0;
    const variation =
      Number.parseFloat(
        dto.cantidad_variacion ?? rec.cantidad_variacion ?? '0',
      ) || 0;
    const tipo = dto.tipo ?? rec.tipo;
    const unitPrice = Number.parseFloat(partida.precio_unitario ?? '0') || 0;
    const signedVariation =
      tipo === 'disminucion' ? Math.abs(variation) * -1 : Math.abs(variation);
    const newQuantity = original + signedVariation;

    if (newQuantity < 0) {
      throw new BadRequestException('La nueva cantidad no puede ser negativa');
    }

    Object.assign(rec, {
      obra_id: obraId,
      partida_id: partidaId,
      tipo,
      descripcion: dto.descripcion ?? rec.descripcion,
      cantidad_original: original.toFixed(4),
      cantidad_variacion: signedVariation.toFixed(4),
      cantidad_nueva: newQuantity.toFixed(4),
      precio_unitario: unitPrice.toFixed(4),
      monto_variacion: (signedVariation * unitPrice).toFixed(2),
      justificacion: dto.justificacion ?? rec.justificacion,
    });

    return this.reconsideracionRepo.save(rec);
  }

  async changeStatus(
    id: string,
    tenantId: string,
    userId: string,
    dto: ChangeReconsideracionStatusDto,
  ) {
    const rec = await this.findOne(id, tenantId);
    rec.status = dto.status;
    rec.approved_by = dto.status === 'aprobada' ? userId : null;
    rec.approved_at = dto.status === 'aprobada' ? new Date() : null;
    return this.reconsideracionRepo.save(rec);
  }

  async remove(id: string, tenantId: string) {
    const rec = await this.findOne(id, tenantId);
    await this.reconsideracionRepo.remove(rec);
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }

  private async findTenantPartida(id: string, tenantId: string) {
    const partida = await this.partidaRepo
      .createQueryBuilder('partida')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(
        BimPresupuesto,
        'presupuesto',
        'presupuesto.id = capitulo.presupuesto_id',
      )
      .innerJoin(BimObra, 'obra', 'obra.id = presupuesto.obra_id')
      .where('partida.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .select([
        'partida.id AS id',
        'partida.cantidad AS cantidad',
        'partida.precio_unitario AS precio_unitario',
        'obra.id AS obra_id',
      ])
      .getRawOne<{
        id: string;
        cantidad: string;
        precio_unitario: string;
        obra_id: string;
      }>();

    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    return partida;
  }
}
