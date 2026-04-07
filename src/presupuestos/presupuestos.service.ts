import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import {
  CreatePresupuestoDto,
  CreateCapituloDto,
  CreatePartidaDto,
} from './dto/create-presupuesto.dto';
import {
  UpdatePresupuestoDto,
  UpdateCapituloDto,
  UpdatePartidaDto,
} from './dto/update-presupuesto.dto';

@Injectable()
export class PresupuestosService {
  constructor(
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    @InjectRepository(BimCapitulo)
    private readonly capituloRepo: Repository<BimCapitulo>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Presupuestos ────────────────────────────────────────
  async create(
    dto: CreatePresupuestoDto,
    userId: string,
  ): Promise<BimPresupuesto> {
    return this.dataSource.transaction(async (manager) => {
      const presupuesto = manager.create(BimPresupuesto, {
        obra_id: dto.obra_id,
        tipo: dto.tipo ?? 'obra',
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        moneda: dto.moneda ?? 'USD',
        gastos_indirectos_pct: dto.gastos_indirectos_pct ?? '0',
        beneficio_pct: dto.beneficio_pct ?? '0',
        iva_pct: dto.iva_pct ?? '21',
        created_by: userId,
      });
      const saved = await manager.save(BimPresupuesto, presupuesto);

      if (dto.capitulos?.length) {
        for (const capDto of dto.capitulos) {
          await this.createCapituloInTransaction(
            manager,
            saved.id,
            capDto,
            null,
          );
        }
      }

      return saved;
    });
  }

  private async createCapituloInTransaction(
    manager: any,
    presupuestoId: string,
    dto: CreateCapituloDto,
    parentId: string | null,
  ): Promise<void> {
    const capitulo = manager.create(BimCapitulo, {
      presupuesto_id: presupuestoId,
      codigo: dto.codigo,
      nombre: dto.nombre,
      orden: dto.orden ?? 0,
      parent_id: parentId ?? dto.parent_id ?? null,
    });
    const savedCap = await manager.save(BimCapitulo, capitulo);

    if (dto.partidas?.length) {
      for (const pDto of dto.partidas) {
        const partida = manager.create(BimPartida, {
          capitulo_id: savedCap.id,
          ...pDto,
        });
        await manager.save(BimPartida, partida);
      }
    }
  }

  async findByObra(obraId: string): Promise<BimPresupuesto[]> {
    return this.presupuestoRepo.find({
      where: { obra_id: obraId },
      order: { version: 'DESC', created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<BimPresupuesto> {
    const p = await this.presupuestoRepo.findOne({
      where: { id },
      relations: ['obra', 'creator', 'aprobador'],
    });
    if (!p) throw new NotFoundException(`Presupuesto #${id} no encontrado`);
    return p;
  }

  async findWithTree(id: string) {
    const presupuesto = await this.findOne(id);

    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: id },
      order: { orden: 'ASC' },
    });

    const partidasPorCapitulo = new Map<string, BimPartida[]>();
    for (const cap of capitulos) {
      const partidas = await this.partidaRepo.find({
        where: { capitulo_id: cap.id },
        order: { orden: 'ASC' },
      });
      partidasPorCapitulo.set(cap.id, partidas);
    }

    return {
      ...presupuesto,
      capitulos: capitulos.map((cap) => ({
        ...cap,
        partidas: partidasPorCapitulo.get(cap.id) ?? [],
      })),
    };
  }

  async update(id: string, dto: UpdatePresupuestoDto): Promise<BimPresupuesto> {
    const p = await this.findOne(id);
    if (p.estado === 'cerrado') {
      throw new BadRequestException(
        'No se puede editar un presupuesto cerrado',
      );
    }
    Object.assign(p, dto);
    return this.presupuestoRepo.save(p);
  }

  async aprobar(id: string, userId: string): Promise<BimPresupuesto> {
    const p = await this.findOne(id);
    if (p.estado !== 'borrador' && p.estado !== 'revisado') {
      throw new BadRequestException(
        'Solo se pueden aprobar presupuestos en borrador o revisado',
      );
    }
    p.estado = 'aprobado';
    p.aprobado_por = userId;
    p.fecha_aprobacion = new Date();
    return this.presupuestoRepo.save(p);
  }

  async remove(id: string): Promise<void> {
    const p = await this.findOne(id);
    if (p.estado === 'aprobado') {
      throw new BadRequestException(
        'No se puede eliminar un presupuesto aprobado',
      );
    }
    await this.presupuestoRepo.remove(p);
  }

  // ── Capítulos ───────────────────────────────────────────
  async createCapitulo(
    presupuestoId: string,
    dto: CreateCapituloDto,
  ): Promise<BimCapitulo> {
    await this.findOne(presupuestoId);
    const cap = this.capituloRepo.create({
      presupuesto_id: presupuestoId,
      ...dto,
    });
    return this.capituloRepo.save(cap);
  }

  async updateCapitulo(
    id: string,
    dto: UpdateCapituloDto,
  ): Promise<BimCapitulo> {
    const cap = await this.capituloRepo.findOneBy({ id });
    if (!cap) throw new NotFoundException(`Capítulo #${id} no encontrado`);
    Object.assign(cap, dto);
    return this.capituloRepo.save(cap);
  }

  async removeCapitulo(id: string): Promise<void> {
    const cap = await this.capituloRepo.findOneBy({ id });
    if (!cap) throw new NotFoundException(`Capítulo #${id} no encontrado`);
    await this.capituloRepo.remove(cap);
  }

  // ── Partidas ────────────────────────────────────────────
  async createPartida(
    capituloId: string,
    dto: CreatePartidaDto,
  ): Promise<BimPartida> {
    const cap = await this.capituloRepo.findOneBy({ id: capituloId });
    if (!cap)
      throw new NotFoundException(`Capítulo #${capituloId} no encontrado`);
    const partida = this.partidaRepo.create({
      capitulo_id: capituloId,
      ...dto,
    });
    return this.partidaRepo.save(partida);
  }

  async updatePartida(id: string, dto: UpdatePartidaDto): Promise<BimPartida> {
    const partida = await this.partidaRepo.findOneBy({ id });
    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    Object.assign(partida, dto);
    return this.partidaRepo.save(partida);
  }

  async removePartida(id: string): Promise<void> {
    const partida = await this.partidaRepo.findOneBy({ id });
    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    await this.partidaRepo.remove(partida);
  }

  // ── Recalcular total del presupuesto ────────────────────
  async recalcularTotal(presupuestoId: string): Promise<BimPresupuesto> {
    const result = await this.partidaRepo
      .createQueryBuilder('p')
      .innerJoin('bim_capitulos', 'c', 'c.id = p.capitulo_id')
      .where('c.presupuesto_id = :presupuestoId', { presupuestoId })
      .select('SUM(p.importe_total)', 'total')
      .getRawOne<{ total: string }>();

    const totalPartidas = parseFloat(result?.total ?? '0');
    const presupuesto = await this.findOne(presupuestoId);
    const gi = parseFloat(presupuesto.gastos_indirectos_pct) / 100;
    const ben = parseFloat(presupuesto.beneficio_pct) / 100;
    const iva = parseFloat(presupuesto.iva_pct) / 100;

    const costeDirecto = totalPartidas;
    const total = costeDirecto * (1 + gi + ben) * (1 + iva);

    presupuesto.total_presupuesto = total.toFixed(2);
    return this.presupuestoRepo.save(presupuesto);
  }
}
