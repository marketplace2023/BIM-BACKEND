import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateMedicionDto } from './dto/create-medicion.dto';
import { UpdateMedicionDto } from './dto/update-medicion.dto';

@Injectable()
export class MedicionesService {
  constructor(
    @InjectRepository(BimMedicion)
    private readonly medicionRepo: Repository<BimMedicion>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
  ) {}

  async create(dto: CreateMedicionDto, userId: string, tenantId: string) {
    const obra = await this.findTenantObra(dto.obra_id, tenantId);
    const partida = await this.findTenantPartida(dto.partida_id, tenantId);

    if (partida.obra_id !== obra.id) {
      throw new BadRequestException('La partida no pertenece a la obra seleccionada');
    }

    const medicion = await this.medicionRepo.save(
      this.medicionRepo.create({
        tenant_id: tenantId,
        obra_id: dto.obra_id,
        partida_id: dto.partida_id,
        fecha_medicion: dto.fecha_medicion,
        cantidad_anterior: '0',
        cantidad_actual: dto.cantidad_actual,
        cantidad_acumulada: '0',
        porcentaje_avance: '0',
        notas: dto.notas ?? null,
        measured_by: userId,
      }),
    );

    await this.recalculatePartidaSequence(dto.partida_id, tenantId);
    return this.findOne(medicion.id, tenantId);
  }

  async findByObra(obraId: string, tenantId: string) {
    await this.findTenantObra(obraId, tenantId);
    return this.medicionRepo.find({
      where: { obra_id: obraId, tenant_id: tenantId },
      relations: ['partida', 'medidor'],
      order: { fecha_medicion: 'DESC', created_at: 'DESC' },
    });
  }

  async findByPartida(partidaId: string, tenantId: string) {
    await this.findTenantPartida(partidaId, tenantId);
    return this.medicionRepo.find({
      where: { partida_id: partidaId, tenant_id: tenantId },
      relations: ['medidor'],
      order: { fecha_medicion: 'ASC', created_at: 'ASC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const medicion = await this.medicionRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['partida', 'medidor', 'obra'],
    });

    if (!medicion) throw new NotFoundException(`Medición #${id} no encontrada`);
    return medicion;
  }

  async update(id: string, tenantId: string, dto: UpdateMedicionDto) {
    const medicion = await this.findOne(id, tenantId);

    if (dto.obra_id && dto.obra_id !== medicion.obra_id) {
      await this.findTenantObra(dto.obra_id, tenantId);
      medicion.obra_id = dto.obra_id;
    }

    if (dto.partida_id && dto.partida_id !== medicion.partida_id) {
      const partida = await this.findTenantPartida(dto.partida_id, tenantId);
      if (dto.obra_id && partida.obra_id !== dto.obra_id) {
        throw new BadRequestException('La partida no pertenece a la obra seleccionada');
      }
      if (!dto.obra_id && partida.obra_id !== medicion.obra_id) {
        throw new BadRequestException('La partida no pertenece a la obra actual');
      }
      medicion.partida_id = dto.partida_id;
    }

    if (dto.fecha_medicion) medicion.fecha_medicion = dto.fecha_medicion;
    if (dto.cantidad_actual) medicion.cantidad_actual = dto.cantidad_actual;
    if (dto.notas !== undefined) medicion.notas = dto.notas ?? null;

    const originalPartidaId = medicion.partida_id;
    await this.medicionRepo.save(medicion);
    await this.recalculatePartidaSequence(originalPartidaId, tenantId);
    if (dto.partida_id && dto.partida_id !== originalPartidaId) {
      await this.recalculatePartidaSequence(dto.partida_id, tenantId);
    }
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    const medicion = await this.findOne(id, tenantId);
    const partidaId = medicion.partida_id;
    await this.medicionRepo.remove(medicion);
    await this.recalculatePartidaSequence(partidaId, tenantId);
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }

  private async findTenantPartida(id: string, tenantId: string) {
    const partida = await this.partidaRepo
      .createQueryBuilder('partida')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(BimPresupuesto, 'presupuesto', 'presupuesto.id = capitulo.presupuesto_id')
      .innerJoin(BimObra, 'obra', 'obra.id = presupuesto.obra_id')
      .where('partida.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .select([
        'partida.id AS id',
        'partida.cantidad AS cantidad',
        'obra.id AS obra_id',
      ])
      .getRawOne<{ id: string; cantidad: string; obra_id: string }>();

    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    return partida;
  }

  private async recalculatePartidaSequence(partidaId: string, tenantId: string) {
    const partida = await this.findTenantPartida(partidaId, tenantId);
    const mediciones = await this.medicionRepo.find({
      where: { partida_id: partidaId, tenant_id: tenantId },
      order: { fecha_medicion: 'ASC', created_at: 'ASC' },
    });

    let acumulada = 0;
    const totalPartida = Number.parseFloat(partida.cantidad ?? '0');

    for (const medicion of mediciones) {
      const actual = Number.parseFloat(medicion.cantidad_actual ?? '0');
      const anterior = acumulada;
      acumulada += actual;

      medicion.cantidad_anterior = anterior.toFixed(4);
      medicion.cantidad_acumulada = acumulada.toFixed(4);
      medicion.porcentaje_avance =
        totalPartida > 0 ? ((acumulada / totalPartida) * 100).toFixed(2) : '0.00';

      await this.medicionRepo.save(medicion);
    }
  }
}
