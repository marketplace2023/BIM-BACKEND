import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateMedicionDocumentoDto } from './dto/create-medicion-documento.dto';
import { UpdateMedicionDocumentoDto } from './dto/update-medicion-documento.dto';
import { SaveMedicionDetallesDto } from './dto/save-medicion-detalles.dto';
import { ChangeDocumentStatusDto } from '../common/dto/change-document-status.dto';

type PartidaBaseRow = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  importe_total: string;
  orden: number;
};

const MEDICION_STATUSES_FOR_ACCUMULATED = ['revisado', 'aprobado'] as const;

@Injectable()
export class MedicionesService {
  constructor(
    @InjectRepository(BimMedicion)
    private readonly medicionRepo: Repository<BimMedicion>,
    @InjectRepository(BimMedicionDocumento)
    private readonly documentoRepo: Repository<BimMedicionDocumento>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    private readonly dataSource: DataSource,
  ) {}

  async createDocumento(
    dto: CreateMedicionDocumentoDto,
    userId: string,
    tenantId: string,
  ) {
    const obra = await this.findTenantObra(dto.obra_id, tenantId);
    const presupuesto = await this.findTenantPresupuesto(dto.presupuesto_id, tenantId);

    if (String(presupuesto.obra_id) !== String(obra.id)) {
      throw new BadRequestException('El presupuesto no pertenece a la obra seleccionada');
    }

    const numero = await this.nextNumero(tenantId, presupuesto.id);
    const fecha = dto.fecha ? dto.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const titulo = dto.titulo?.trim() || `CONTROL DE MEDICIONES Nro. ${numero}`;

    return this.documentoRepo.save(
      this.documentoRepo.create({
        tenant_id: tenantId,
        obra_id: obra.id,
        presupuesto_id: presupuesto.id,
        numero,
        fecha,
        titulo,
        status: 'borrador',
        observaciones: dto.observaciones ?? null,
        created_by: userId,
        approved_by: null,
        approved_at: null,
      }),
    );
  }

  async findByObra(
    obraId: string,
    tenantId: string,
    presupuestoId?: string,
  ) {
    await this.findTenantObra(obraId, tenantId);

    const where: {
      obra_id: string;
      tenant_id: string;
      presupuesto_id?: string;
    } = {
      obra_id: obraId,
      tenant_id: tenantId,
    };

    if (presupuestoId) {
      const presupuesto = await this.findTenantPresupuesto(presupuestoId, tenantId);
      where.presupuesto_id = presupuesto.id;
    }

    return this.documentoRepo.find({
      where,
      relations: ['presupuesto', 'creador', 'aprobador'],
      order: { numero: 'DESC', created_at: 'DESC' },
    });
  }

  async findDocumento(id: string, tenantId: string) {
    const documento = await this.documentoRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'presupuesto', 'creador', 'aprobador'],
    });

    if (!documento) {
      throw new NotFoundException(`Documento de medición #${id} no encontrado`);
    }

    return documento;
  }

  async updateDocumento(
    id: string,
    tenantId: string,
    dto: UpdateMedicionDocumentoDto,
  ) {
    const documento = await this.findDocumento(id, tenantId);

    if (documento.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar documentos en borrador');
    }

    if (dto.obra_id && dto.obra_id !== documento.obra_id) {
      const obra = await this.findTenantObra(dto.obra_id, tenantId);
      documento.obra_id = obra.id;
    }

    if (dto.presupuesto_id && dto.presupuesto_id !== documento.presupuesto_id) {
      const presupuesto = await this.findTenantPresupuesto(dto.presupuesto_id, tenantId);
      if (String(presupuesto.obra_id) !== String(documento.obra_id)) {
        throw new BadRequestException('El presupuesto no pertenece a la obra seleccionada');
      }
      documento.presupuesto_id = presupuesto.id;
    }

    if (dto.fecha) documento.fecha = dto.fecha.slice(0, 10);
    if (dto.titulo !== undefined) documento.titulo = dto.titulo.trim();
    if (dto.observaciones !== undefined) documento.observaciones = dto.observaciones || null;

    return this.documentoRepo.save(documento);
  }

  async removeDocumento(id: string, tenantId: string) {
    const documento = await this.findDocumento(id, tenantId);
    await this.documentoRepo.remove(documento);
  }

  async changeStatus(
    id: string,
    dto: ChangeDocumentStatusDto,
    userId: string,
    tenantId: string,
  ) {
    const documento = await this.findDocumento(id, tenantId);
    this.assertValidStatusTransition(documento.status, dto.status);

    documento.status = dto.status;
    if (dto.observaciones !== undefined) {
      documento.observaciones = dto.observaciones || null;
    }
    if (dto.status === 'aprobado') {
      documento.approved_by = userId;
      documento.approved_at = new Date();
    } else {
      documento.approved_by = null;
      documento.approved_at = null;
    }

    const saved = await this.documentoRepo.save(documento);
    await this.recalculatePresupuestoSequence(documento.presupuesto_id, tenantId);

    return saved;
  }

  async getDocumentoResumen(id: string, tenantId: string) {
    const documento = await this.findDocumento(id, tenantId);
    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const medicionesPrevias = await this.buildAcumulados(documento, tenantId, true);
    const actuales = await this.medicionRepo.find({
      where: { documento_id: documento.id, tenant_id: tenantId },
      order: { id: 'ASC' },
    });

    const actualesByPartida = new Map(actuales.map((item) => [String(item.partida_id), item]));

    const detalle = partidas.map((partida, index) => {
      const cantidadPresupuestada = this.toNumber(partida.cantidad);
      const actual = actualesByPartida.get(String(partida.id));
      const anterior = medicionesPrevias.get(String(partida.id)) ?? 0;
      const actualCantidad = actual ? this.toNumber(actual.cantidad_actual) : 0;
      const acumulada = anterior + actualCantidad;
      const avance = cantidadPresupuestada > 0 ? (acumulada / cantidadPresupuestada) * 100 : 0;
      const diferencia = acumulada - cantidadPresupuestada;
      const estado = cantidadPresupuestada === 0 && acumulada > 0
        ? 'obra_extra'
        : diferencia > 0
          ? 'aumento'
          : diferencia < 0
            ? 'disminucion'
            : 'sin_variacion';

      return {
        partida_id: partida.id,
        nro: index + 1,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        cantidad_presupuestada: cantidadPresupuestada.toFixed(4),
        cantidad_anterior: anterior.toFixed(4),
        cantidad_actual: actualCantidad.toFixed(4),
        cantidad_acumulada: acumulada.toFixed(4),
        diferencia: diferencia.toFixed(4),
        estado,
        porcentaje_avance: avance.toFixed(2),
        notas: actual?.notas ?? null,
      };
    });

    const totalPresupuestado = detalle.reduce((sum, item) => sum + this.toNumber(item.cantidad_presupuestada), 0);
    const totalAnterior = detalle.reduce((sum, item) => sum + this.toNumber(item.cantidad_anterior), 0);
    const totalActual = detalle.reduce((sum, item) => sum + this.toNumber(item.cantidad_actual), 0);
    const totalAcumulado = detalle.reduce((sum, item) => sum + this.toNumber(item.cantidad_acumulada), 0);
    const avanceGlobal = totalPresupuestado > 0 ? (totalAcumulado / totalPresupuestado) * 100 : 0;
    const resumenVariaciones = detalle.reduce(
      (acc, item) => {
        if (item.estado === 'aumento') acc.aumentos += 1;
        else if (item.estado === 'disminucion') acc.disminuciones += 1;
        else if (item.estado === 'obra_extra') acc.extras += 1;
        else acc.sin_variacion += 1;
        return acc;
      },
      { aumentos: 0, disminuciones: 0, extras: 0, sin_variacion: 0 },
    );

    return {
      documento,
      resumen: {
        presupuestado: totalPresupuestado.toFixed(4),
        anterior: totalAnterior.toFixed(4),
        actual: totalActual.toFixed(4),
        acumulado: totalAcumulado.toFixed(4),
        porcentaje_avance: avanceGlobal.toFixed(2),
        variaciones: resumenVariaciones,
      },
      detalle,
    };
  }

  async saveDocumentoDetalles(
    id: string,
    userId: string,
    tenantId: string,
    dto: SaveMedicionDetallesDto,
  ) {
    const documento = await this.findDocumento(id, tenantId);

    if (documento.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar documentos en borrador');
    }

    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const partidasMap = new Map(partidas.map((item) => [String(item.id), item]));

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BimMedicion);
      const existentes = await repo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
      });
      const existentesByPartida = new Map(existentes.map((item) => [String(item.partida_id), item]));
      const payload = new Map(dto.detalles.map((item) => [String(item.partida_id), item]));

      for (const [partidaId] of partidasMap.entries()) {
        const item = payload.get(partidaId);
        const actual = item ? Math.max(this.toNumber(item.cantidad_actual), 0) : 0;
        const existente = existentesByPartida.get(partidaId);

        if (actual <= 0) {
          if (existente) {
            await repo.remove(existente);
          }
          continue;
        }

        const row = existente ?? repo.create({
          tenant_id: tenantId,
          obra_id: documento.obra_id,
          documento_id: documento.id,
          partida_id: partidaId,
          measured_by: userId,
        });

        row.tenant_id = tenantId;
        row.obra_id = documento.obra_id;
        row.documento_id = documento.id;
        row.partida_id = partidaId;
        row.fecha_medicion = documento.fecha;
        row.cantidad_actual = actual.toFixed(4);
        row.notas = item?.notas ?? null;
        row.measured_by = userId;

        await repo.save(row);
      }

      await this.recalculatePresupuestoSequence(documento.presupuesto_id, tenantId, manager);
    });

    return this.getDocumentoResumen(documento.id, tenantId);
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }

  private async findTenantPresupuesto(id: string, tenantId: string) {
    const presupuesto = await this.presupuestoRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!presupuesto) throw new NotFoundException(`Presupuesto #${id} no encontrado`);

    if (presupuesto.tipo !== 'modificado') {
      return presupuesto;
    }

    if (!presupuesto.presupuesto_base_id) {
      throw new BadRequestException(
        'El presupuesto modificado no tiene un presupuesto base asociado para operar.',
      );
    }

    const presupuestoBase = await this.presupuestoRepo.findOne({
      where: { id: presupuesto.presupuesto_base_id, tenant_id: tenantId },
    });
    if (!presupuestoBase) {
      throw new NotFoundException(
        `Presupuesto base #${presupuesto.presupuesto_base_id} no encontrado`,
      );
    }

    return presupuestoBase;
  }

  private async nextNumero(tenantId: string, presupuestoId: string) {
    const last = await this.documentoRepo.findOne({
      where: { tenant_id: tenantId, presupuesto_id: presupuestoId },
      order: { numero: 'DESC' },
    });
    return (last?.numero ?? 0) + 1;
  }

  private async findPresupuestoPartidas(presupuestoId: string, tenantId: string): Promise<PartidaBaseRow[]> {
    const presupuesto = await this.findTenantPresupuesto(presupuestoId, tenantId);

    return this.partidaRepo
      .createQueryBuilder('partida')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(BimPresupuesto, 'presupuesto', 'presupuesto.id = capitulo.presupuesto_id')
      .where('presupuesto.id = :presupuestoId', { presupuestoId: presupuesto.id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .select([
        'partida.id AS id',
        'partida.codigo AS codigo',
        'partida.descripcion AS descripcion',
        'partida.unidad AS unidad',
        'partida.cantidad AS cantidad',
        'partida.precio_unitario AS precio_unitario',
        'partida.importe_total AS importe_total',
        'partida.orden AS orden',
      ])
      .orderBy('partida.orden', 'ASC')
      .addOrderBy('partida.id', 'ASC')
      .getRawMany<PartidaBaseRow>();
  }

  private async buildAcumulados(
    documento: BimMedicionDocumento,
    tenantId: string,
    previosSolo: boolean,
  ) {
    const query = this.medicionRepo
      .createQueryBuilder('med')
      .innerJoin(BimMedicionDocumento, 'doc', 'doc.id = med.documento_id')
      .where('doc.tenant_id = :tenantId', { tenantId })
      .andWhere('doc.presupuesto_id = :presupuestoId', { presupuestoId: documento.presupuesto_id })
      .andWhere('doc.status IN (:...allowedStatuses)', {
        allowedStatuses: [...MEDICION_STATUSES_FOR_ACCUMULATED],
      })
      .select([
        'med.partida_id AS partida_id',
        'SUM(med.cantidad_actual) AS cantidad',
      ])
      .groupBy('med.partida_id');

    if (previosSolo) {
      query.andWhere(
        '(doc.numero < :numero OR (doc.numero = :numero AND doc.id < :documentoId))',
        { numero: documento.numero, documentoId: documento.id },
      );
    } else {
      query.andWhere(
        '(doc.numero < :numero OR (doc.numero = :numero AND doc.id <= :documentoId))',
        { numero: documento.numero, documentoId: documento.id },
      );
    }

    const rows = await query.getRawMany<{ partida_id: string; cantidad: string }>();
    const map = new Map<string, number>();

    for (const row of rows) {
      map.set(String(row.partida_id), this.toNumber(row.cantidad));
    }

    return map;
  }

  private async recalculatePresupuestoSequence(
    presupuestoId: string,
    tenantId: string,
    manager?: DataSource | any,
  ) {
    const repo = manager ? manager.getRepository(BimMedicion) : this.medicionRepo;
    const documentoRepo = manager
      ? manager.getRepository(BimMedicionDocumento)
      : this.documentoRepo;

    const documentos = await documentoRepo.find({
      where: { presupuesto_id: presupuestoId, tenant_id: tenantId },
      order: { numero: 'ASC', created_at: 'ASC' },
    });

    const acumulados = new Map<string, number>();

    for (const documento of documentos) {
      const rows = await repo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
        order: { id: 'ASC' },
      });

      for (const row of rows) {
        const anterior = acumulados.get(String(row.partida_id)) ?? 0;
        const actual = this.toNumber(row.cantidad_actual);
        const acumulada = anterior + actual;
        row.cantidad_anterior = anterior.toFixed(4);
        row.cantidad_acumulada = acumulada.toFixed(4);

        const partida = await repo.manager.getRepository(BimPartida).findOne({
          where: { id: row.partida_id },
        });
        const totalPartida = this.toNumber(partida?.cantidad ?? '0');
        row.porcentaje_avance = totalPartida > 0 ? ((acumulada / totalPartida) * 100).toFixed(2) : '0.00';
        await repo.save(row);
        if (MEDICION_STATUSES_FOR_ACCUMULATED.includes(documento.status as (typeof MEDICION_STATUSES_FOR_ACCUMULATED)[number])) {
          acumulados.set(String(row.partida_id), acumulada);
        }
      }
    }
  }

  private toNumber(value: string | number | null | undefined) {
    return Number.parseFloat(String(value ?? '0')) || 0;
  }

  private assertValidStatusTransition(current: string, next: string) {
    if (current === next) return;
    const allowed: Record<string, string[]> = {
      borrador: ['revisado'],
      revisado: ['borrador', 'aprobado'],
      aprobado: [],
    };
    if (!(allowed[current] ?? []).includes(next)) {
      throw new BadRequestException(`No se puede cambiar de ${current} a ${next}`);
    }
  }
}
