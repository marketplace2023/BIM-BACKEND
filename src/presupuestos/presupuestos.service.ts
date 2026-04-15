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
import { BimPartidaMaterial } from '../database/entities/bim/bim-partida-material.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimApuDescomposicion } from '../database/entities/bim/bim-apu-descomposicion.entity';
import { BimPrecioUnitario } from '../database/entities/bim/bim-precio-unitario.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import {
  CreatePresupuestoDto,
  CreateCapituloDto,
  CreatePartidaDto,
  CreatePartidaMaterialDto,
} from './dto/create-presupuesto.dto';
import {
  UpdatePresupuestoDto,
  UpdateCapituloDto,
  UpdatePartidaDto,
  UpdatePartidaMaterialDto,
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
    @InjectRepository(BimPartidaMaterial)
    private readonly partidaMaterialRepo: Repository<BimPartidaMaterial>,
    @InjectRepository(BimRecurso)
    private readonly recursoRepo: Repository<BimRecurso>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Presupuestos ────────────────────────────────────────
  async create(
    dto: CreatePresupuestoDto,
    userId: string,
    tenantId: string,
  ): Promise<BimPresupuesto> {
    await this.findTenantObra(dto.obra_id, tenantId);
    return this.dataSource.transaction(async (manager) => {
      const presupuesto = manager.create(BimPresupuesto, {
        tenant_id: tenantId,
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

  async findByObra(
    obraId: string,
    tenantId: string,
  ): Promise<BimPresupuesto[]> {
    await this.findTenantObra(obraId, tenantId);
    return this.presupuestoRepo.find({
      where: { obra_id: obraId, tenant_id: tenantId },
      order: { version: 'DESC', created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<BimPresupuesto> {
    const p = await this.presupuestoRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'creator', 'aprobador'],
    });
    if (!p) throw new NotFoundException(`Presupuesto #${id} no encontrado`);
    return p;
  }

  async findWithTree(id: string, tenantId: string) {
    const presupuesto = await this.findOne(id, tenantId);

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

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePresupuestoDto,
  ): Promise<BimPresupuesto> {
    const p = await this.findOne(id, tenantId);
    if (p.estado === 'cerrado') {
      throw new BadRequestException(
        'No se puede editar un presupuesto cerrado',
      );
    }
    Object.assign(p, dto);
    return this.presupuestoRepo.save(p);
  }

  async aprobar(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<BimPresupuesto> {
    const p = await this.findOne(id, tenantId);
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

  async devolverABorrador(
    id: string,
    tenantId: string,
  ): Promise<BimPresupuesto> {
    const p = await this.findOne(id, tenantId);
    if (p.estado !== 'aprobado' && p.estado !== 'revisado') {
      throw new BadRequestException(
        'Solo se pueden devolver a borrador presupuestos aprobados o revisados',
      );
    }

    p.estado = 'borrador';
    p.aprobado_por = null;
    p.fecha_aprobacion = null;
    return this.presupuestoRepo.save(p);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const p = await this.findOne(id, tenantId);
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
    tenantId: string,
    dto: CreateCapituloDto,
  ): Promise<BimCapitulo> {
    await this.findOne(presupuestoId, tenantId);
    const cap = this.capituloRepo.create({
      presupuesto_id: presupuestoId,
      ...dto,
    });
    return this.capituloRepo.save(cap);
  }

  async updateCapitulo(
    id: string,
    tenantId: string,
    dto: UpdateCapituloDto,
  ): Promise<BimCapitulo> {
    const cap = await this.findCapitulo(id, tenantId);
    if (!cap) throw new NotFoundException(`Capítulo #${id} no encontrado`);
    Object.assign(cap, dto);
    return this.capituloRepo.save(cap);
  }

  async removeCapitulo(id: string, tenantId: string): Promise<void> {
    const cap = await this.findCapitulo(id, tenantId);
    if (!cap) throw new NotFoundException(`Capítulo #${id} no encontrado`);
    await this.capituloRepo.remove(cap);
  }

  // ── Partidas ────────────────────────────────────────────
  async createPartida(
    capituloId: string,
    tenantId: string,
    dto: CreatePartidaDto,
  ): Promise<BimPartida> {
    const cap = await this.findCapitulo(capituloId, tenantId);
    if (!cap)
      throw new NotFoundException(`Capítulo #${capituloId} no encontrado`);
    return this.dataSource.transaction(async (manager) => {
      const partida = manager.create(BimPartida, {
        capitulo_id: capituloId,
        ...dto,
      });
      const savedPartida = await manager.save(BimPartida, partida);

      await this.seedPartidaMaterialesFromApu(manager, savedPartida, tenantId);
      await this.recalcularPrecioUnitarioPartida(savedPartida.id, tenantId, manager);

      return this.findPartida(savedPartida.id, tenantId, manager);
    });
  }

  async updatePartida(
    id: string,
    tenantId: string,
    dto: UpdatePartidaDto,
  ): Promise<BimPartida> {
    return this.dataSource.transaction(async (manager) => {
      const partida = await this.findPartida(id, tenantId, manager);
      Object.assign(partida, dto);
      const saved = await manager.save(BimPartida, partida);
      return saved;
    });
  }

  async removePartida(id: string, tenantId: string): Promise<void> {
    const partida = await this.findPartida(id, tenantId);
    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    await this.partidaRepo.remove(partida);
  }

  async findPartidaMateriales(
    partidaId: string,
    tenantId: string,
    tipo?: string,
  ): Promise<BimPartidaMaterial[]> {
    const partida = await this.findPartida(partidaId, tenantId);
    const where: { partida_id: string; tipo?: string } = { partida_id: partida.id };
    if (tipo) where.tipo = tipo;
    return this.partidaMaterialRepo.find({
      where,
      order: { orden: 'ASC', id: 'ASC' },
    });
  }

  async createPartidaMaterial(
    partidaId: string,
    tenantId: string,
    dto: CreatePartidaMaterialDto,
  ): Promise<BimPartidaMaterial> {
    return this.dataSource.transaction(async (manager) => {
      const partida = await this.findPartida(partidaId, tenantId, manager);
      const recurso = dto.recurso_id
        ? await this.findAccessibleRecurso(dto.recurso_id, tenantId, manager)
        : null;
      const item = manager.create(BimPartidaMaterial, {
        partida_id: partida.id,
        recurso_id: recurso?.id ?? dto.recurso_id ?? null,
        tipo: dto.tipo ?? recurso?.tipo ?? 'material',
        codigo: dto.codigo,
        descripcion: dto.descripcion,
        unidad: dto.unidad,
        cantidad: dto.cantidad,
        costo: dto.costo,
        desperdicio_pct: dto.desperdicio_pct ?? '0',
        orden: dto.orden ?? 0,
      });
      const saved = await manager.save(BimPartidaMaterial, item);
      await this.recalcularPrecioUnitarioPartida(partida.id, tenantId, manager);
      return saved;
    });
  }

  async updatePartidaMaterial(
    id: string,
    tenantId: string,
    dto: UpdatePartidaMaterialDto,
  ): Promise<BimPartidaMaterial> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.findPartidaMaterial(id, tenantId, manager);
      if (dto.recurso_id) {
        const recurso = await this.findAccessibleRecurso(dto.recurso_id, tenantId, manager);
        item.recurso_id = recurso.id;
      }
      Object.assign(item, dto);
      const saved = await manager.save(BimPartidaMaterial, item);
      await this.recalcularPrecioUnitarioPartida(item.partida_id, tenantId, manager);
      return saved;
    });
  }

  async removePartidaMaterial(id: string, tenantId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const item = await this.findPartidaMaterial(id, tenantId, manager);
      const partidaId = item.partida_id;
      await manager.remove(BimPartidaMaterial, item);
      await this.recalcularPrecioUnitarioPartida(partidaId, tenantId, manager);
    });
  }

  // ── Recalcular total del presupuesto ────────────────────
  async recalcularTotal(
    presupuestoId: string,
    tenantId: string,
  ): Promise<BimPresupuesto> {
    const result = await this.partidaRepo
      .createQueryBuilder('p')
      .innerJoin('bim_capitulos', 'c', 'c.id = p.capitulo_id')
      .where('c.presupuesto_id = :presupuestoId', { presupuestoId })
      .select('SUM(p.importe_total)', 'total')
      .getRawOne<{ total: string }>();

    const totalPartidas = parseFloat(result?.total ?? '0');
    const presupuesto = await this.findOne(presupuestoId, tenantId);
    const gi = parseFloat(presupuesto.gastos_indirectos_pct) / 100;
    const ben = parseFloat(presupuesto.beneficio_pct) / 100;
    const iva = parseFloat(presupuesto.iva_pct) / 100;

    const costeDirecto = totalPartidas;
    const total = costeDirecto * (1 + gi + ben) * (1 + iva);

    presupuesto.total_presupuesto = total.toFixed(2);
    return this.presupuestoRepo.save(presupuesto);
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }

  private async findCapitulo(id: string, tenantId: string, manager?: any) {
    const repo = manager ? manager.getRepository(BimCapitulo) : this.capituloRepo;
    const capitulo = await repo
      .createQueryBuilder('cap')
      .innerJoin(
        BimPresupuesto,
        'presupuesto',
        'presupuesto.id = cap.presupuesto_id',
      )
      .where('cap.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!capitulo) throw new NotFoundException(`Capítulo #${id} no encontrado`);
    return capitulo;
  }

  private async findPartida(id: string, tenantId: string, manager?: any) {
    const repo = manager ? manager.getRepository(BimPartida) : this.partidaRepo;
    const partida = await repo
      .createQueryBuilder('partida')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(
        BimPresupuesto,
        'presupuesto',
        'presupuesto.id = capitulo.presupuesto_id',
      )
      .where('partida.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    return partida;
  }

  private async findPartidaMaterial(id: string, tenantId: string, manager?: any) {
    const repo = manager
      ? manager.getRepository(BimPartidaMaterial)
      : this.partidaMaterialRepo;
    const item = await repo
      .createQueryBuilder('material')
      .innerJoin(BimPartida, 'partida', 'partida.id = material.partida_id')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(
        BimPresupuesto,
        'presupuesto',
        'presupuesto.id = capitulo.presupuesto_id',
      )
      .where('material.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!item) {
      throw new NotFoundException(`Material de partida #${id} no encontrado`);
    }

    return item;
  }

  private async findAccessibleRecurso(id: string, tenantId: string, manager?: any) {
    const repo = manager ? manager.getRepository(BimRecurso) : this.recursoRepo;
    const recurso = await repo
      .createQueryBuilder('recurso')
      .where('recurso.id = :id', { id: Number(id) })
      .andWhere('recurso.tenant_id IN (:...tenantIds)', {
        tenantIds: tenantId === '1' ? [1] : [1, Number(tenantId)],
      })
      .andWhere('recurso.activo = 1')
      .getOne();

    if (!recurso) throw new NotFoundException(`Recurso #${id} no encontrado`);
    return recurso;
  }

  private async seedPartidaMaterialesFromApu(
    manager: any,
    partida: BimPartida,
    tenantId: string,
  ): Promise<void> {
    if (!partida.precio_unitario_id) return;

    const pu = await manager
      .getRepository(BimPrecioUnitario)
      .createQueryBuilder('pu')
      .where('pu.id = :id', { id: Number(partida.precio_unitario_id) })
      .andWhere('pu.tenant_id IN (:...tenantIds)', {
        tenantIds: tenantId === '1' ? [1] : [1, Number(tenantId)],
      })
      .getOne();

    if (!pu) return;

    const materiales = await manager
      .getRepository(BimApuDescomposicion)
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.recurso', 'recurso')
      .where('d.precio_unitario_id = :puId', { puId: Number(pu.id) })
      .andWhere('d.tipo IN (:...tipos)', {
        tipos: ['material', 'equipo', 'mano_obra'],
      })
      .orderBy('d.orden', 'ASC')
      .addOrderBy('d.id', 'ASC')
      .getMany();

    if (!materiales.length) return;

    const rows = materiales.map((item) =>
      manager.create(BimPartidaMaterial, {
        partida_id: partida.id,
        recurso_id: item.recurso_id,
        tipo: item.tipo,
        codigo: item.recurso?.codigo ?? `MAT-${item.recurso_id}`,
        descripcion: item.recurso?.descripcion ?? partida.descripcion,
        unidad: item.recurso?.unidad ?? partida.unidad,
        cantidad: item.cantidad,
        costo: item.precio_recurso,
        desperdicio_pct: '0',
        orden: item.orden,
      }),
    );

    await manager.save(BimPartidaMaterial, rows);
  }

  private async recalcularPrecioUnitarioPartida(
    partidaId: string,
    tenantId: string,
    manager?: any,
  ): Promise<void> {
    const materialRepo = manager
      ? manager.getRepository(BimPartidaMaterial)
      : this.partidaMaterialRepo;
    const partidaRepo = manager ? manager.getRepository(BimPartida) : this.partidaRepo;

    const result = await materialRepo
      .createQueryBuilder('material')
      .where('material.partida_id = :partidaId', { partidaId })
      .select('SUM(material.total)', 'total')
      .getRawOne();

    const partida = await this.findPartida(partidaId, tenantId, manager);
    partida.precio_unitario =
      (parseFloat((result as { total?: string | null } | null)?.total ?? '0') || 0).toFixed(4);
    await partidaRepo.save(partida);
  }
}
