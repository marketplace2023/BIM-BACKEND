import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { CreateReconsideracionDocumentoDto } from './dto/create-reconsideracion-documento.dto';
import { UpdateReconsideracionDocumentoDto } from './dto/update-reconsideracion-documento.dto';
import { SaveReconsideracionDetallesDto } from './dto/save-reconsideracion-detalles.dto';

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

type AcumuladoMap = Map<
  string,
  { cantidadAumento: number; montoAumento: number; cantidadDisminucion: number; montoDisminucion: number }
>;

@Injectable()
export class ReconsideracionesService {
  constructor(
    @InjectRepository(BimReconsideracion)
    private readonly reconsideracionRepo: Repository<BimReconsideracion>,
    @InjectRepository(BimReconsideracionDocumento)
    private readonly documentoRepo: Repository<BimReconsideracionDocumento>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    private readonly dataSource: DataSource,
  ) {}

  async createDocumento(
    dto: CreateReconsideracionDocumentoDto,
    userId: string,
    tenantId: string,
  ) {
    const obra = await this.findTenantObra(dto.obra_id, tenantId);
    const presupuesto = await this.findTenantPresupuesto(dto.presupuesto_id, tenantId);

    if (String(presupuesto.obra_id) !== String(obra.id)) {
      throw new BadRequestException('El presupuesto no pertenece a la obra seleccionada');
    }

    const tipo = dto.tipo ?? 'aumento';
    const numero = await this.nextNumero(tenantId, presupuesto.id, tipo);
    const fecha = dto.fecha ? dto.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const titulo = dto.titulo?.trim() || `${tipo === 'aumento' ? 'PRESUPUESTO DE AUMENTOS' : 'PRESUPUESTO DE DISMINUCIONES'} Nro. ${numero}`;

    return this.documentoRepo.save(
      this.documentoRepo.create({
        tenant_id: tenantId,
        obra_id: obra.id,
        presupuesto_id: presupuesto.id,
        tipo,
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
    tipo?: string,
    presupuestoId?: string,
  ) {
    await this.findTenantObra(obraId, tenantId);

    const where: {
      obra_id: string;
      tenant_id: string;
      tipo?: string;
      presupuesto_id?: string;
    } = {
      obra_id: obraId,
      tenant_id: tenantId,
    };

    if (tipo) where.tipo = tipo;
    if (presupuestoId) where.presupuesto_id = presupuestoId;

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
      throw new NotFoundException(`Documento de reconsideración #${id} no encontrado`);
    }

    return documento;
  }

  async updateDocumento(
    id: string,
    tenantId: string,
    dto: UpdateReconsideracionDocumentoDto,
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

  async getDocumentoResumen(id: string, tenantId: string) {
    const documento = await this.findDocumento(id, tenantId);
    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const acumuladosPrevios = await this.buildAcumulados(documento, tenantId, true);
    const acumuladosTodos = await this.buildAcumulados(documento, tenantId, false);
    const actuales = await this.reconsideracionRepo.find({
      where: { documento_id: documento.id, tenant_id: tenantId },
      order: { id: 'ASC' },
    });

    const actualesByPartida = new Map(actuales.map((item) => [String(item.partida_id), item]));

    const detalle = partidas.map((partida, index) => {
      const cantidadOriginal = this.toNumber(partida.cantidad);
      const precioUnitario = this.toNumber(partida.precio_unitario);
      const totalOriginal = this.toNumber(partida.importe_total);
      const actual = actualesByPartida.get(String(partida.id));
      const previos = acumuladosPrevios.get(String(partida.id)) ?? this.emptyAcumulado();
      const totales = acumuladosTodos.get(String(partida.id)) ?? this.emptyAcumulado();
      const aumentoActual = actual && actual.tipo === 'aumento' ? this.toNumber(actual.cantidad_variacion) : 0;
      const montoAumentoActual = actual && actual.tipo === 'aumento' ? this.toNumber(actual.monto_variacion) : 0;
      const cantidadModificada = cantidadOriginal + totales.cantidadAumento - totales.cantidadDisminucion;
      const totalModificado = cantidadModificada * precioUnitario;
      const porEjecutar = cantidadOriginal + previos.cantidadAumento - previos.cantidadDisminucion;
      const totalPorEjecutar = porEjecutar * precioUnitario;

      return {
        partida_id: partida.id,
        nro: index + 1,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        cantidad_original: cantidadOriginal.toFixed(4),
        precio_unitario: precioUnitario.toFixed(4),
        total_original: totalOriginal.toFixed(2),
        aumento_actual: aumentoActual.toFixed(4),
        monto_aumento_actual: montoAumentoActual.toFixed(2),
        cantidad_aumento_acumulado: totales.cantidadAumento.toFixed(4),
        total_aumento_acumulado: totales.montoAumento.toFixed(2),
        cantidad_disminucion_acumulada: totales.cantidadDisminucion.toFixed(4),
        total_disminucion_acumulada: totales.montoDisminucion.toFixed(2),
        por_ejecutar: porEjecutar.toFixed(4),
        total_por_ejecutar: totalPorEjecutar.toFixed(2),
        cantidad_modificada: cantidadModificada.toFixed(4),
        total_modificado: totalModificado.toFixed(2),
        justificacion: actual?.justificacion ?? null,
      };
    });

    const totalOriginal = detalle.reduce((sum, item) => sum + this.toNumber(item.total_original), 0);
    const totalAumentosActuales = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_aumento_actual), 0);
    const totalAumentosPrevios = detalle.reduce((sum, item) => sum + (this.toNumber(item.total_aumento_acumulado) - this.toNumber(item.monto_aumento_actual)), 0);
    const totalDisminuciones = detalle.reduce((sum, item) => sum + this.toNumber(item.total_disminucion_acumulada), 0);
    const totalModificado = detalle.reduce((sum, item) => sum + this.toNumber(item.total_modificado), 0);

    return {
      documento,
      resumen: {
        original: totalOriginal.toFixed(2),
        extras: '0.00',
        aumentos_anteriores: totalAumentosPrevios.toFixed(2),
        aumentos_actuales: totalAumentosActuales.toFixed(2),
        aumentos_acumulados: (totalAumentosPrevios + totalAumentosActuales).toFixed(2),
        disminuciones: totalDisminuciones.toFixed(2),
        modificado: totalModificado.toFixed(2),
      },
      detalle,
    };
  }

  async saveDocumentoDetalles(
    id: string,
    userId: string,
    tenantId: string,
    dto: SaveReconsideracionDetallesDto,
  ) {
    const documento = await this.findDocumento(id, tenantId);
    if (documento.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar documentos en borrador');
    }

    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const partidasMap = new Map(partidas.map((item) => [String(item.id), item]));

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BimReconsideracion);
      const existentes = await repo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
      });
      const existentesByPartida = new Map(existentes.map((item) => [String(item.partida_id), item]));
      const payload = new Map(dto.detalles.map((item) => [String(item.partida_id), item]));

      for (const [partidaId, partida] of partidasMap.entries()) {
        const item = payload.get(partidaId);
        const variacion = item ? Math.max(this.toNumber(item.cantidad_variacion), 0) : 0;
        const existente = existentesByPartida.get(partidaId);
        const cantidadOriginal = this.toNumber(partida.cantidad);
        const precioUnitario = this.toNumber(partida.precio_unitario);
        const signedVariation = documento.tipo === 'disminucion' ? variacion * -1 : variacion;
        const cantidadNueva = cantidadOriginal + signedVariation;

        if (cantidadNueva < 0) {
          throw new BadRequestException(`La nueva cantidad no puede ser negativa para la partida ${partida.codigo}`);
        }

        if (variacion <= 0) {
          if (existente) {
            await repo.remove(existente);
          }
          continue;
        }

        const row = existente ?? repo.create({
          tenant_id: tenantId,
          obra_id: documento.obra_id,
          documento_id: documento.id,
          partida_id: partida.id,
          created_by: userId,
          approved_by: null,
          approved_at: null,
          status: 'borrador',
        });

        Object.assign(row, {
          tenant_id: tenantId,
          obra_id: documento.obra_id,
          documento_id: documento.id,
          partida_id: partida.id,
          tipo: documento.tipo,
          descripcion: partida.descripcion,
          cantidad_original: cantidadOriginal.toFixed(4),
          cantidad_variacion: signedVariation.toFixed(4),
          cantidad_nueva: cantidadNueva.toFixed(4),
          precio_unitario: precioUnitario.toFixed(4),
          monto_variacion: (Math.abs(signedVariation) * precioUnitario).toFixed(2),
          justificacion: item?.justificacion ?? null,
          status: 'borrador',
        });

        await repo.save(row);
      }
    });

    return this.getDocumentoResumen(documento.id, tenantId);
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!obra) {
      throw new NotFoundException(`Obra #${id} no encontrada`);
    }
    return obra;
  }

  private async findTenantPresupuesto(id: string, tenantId: string) {
    const presupuesto = await this.presupuestoRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!presupuesto) {
      throw new NotFoundException(`Presupuesto #${id} no encontrado`);
    }
    return presupuesto;
  }

  private async nextNumero(tenantId: string, presupuestoId: string, tipo: string) {
    const last = await this.documentoRepo.findOne({
      where: { tenant_id: tenantId, presupuesto_id: presupuestoId, tipo },
      order: { numero: 'DESC' },
    });
    return (last?.numero ?? 0) + 1;
  }

  private async findPresupuestoPartidas(presupuestoId: string, tenantId: string): Promise<PartidaBaseRow[]> {
    await this.findTenantPresupuesto(presupuestoId, tenantId);

    return this.partidaRepo
      .createQueryBuilder('partida')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(BimPresupuesto, 'presupuesto', 'presupuesto.id = capitulo.presupuesto_id')
      .where('presupuesto.id = :presupuestoId', { presupuestoId })
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
    documento: BimReconsideracionDocumento,
    tenantId: string,
    previosSolo: boolean,
  ): Promise<AcumuladoMap> {
    const query = this.reconsideracionRepo
      .createQueryBuilder('rec')
      .innerJoin(BimReconsideracionDocumento, 'doc', 'doc.id = rec.documento_id')
      .where('doc.tenant_id = :tenantId', { tenantId })
      .andWhere('doc.presupuesto_id = :presupuestoId', { presupuestoId: documento.presupuesto_id })
      .select([
        'rec.partida_id AS partida_id',
        'rec.tipo AS tipo',
        'SUM(ABS(rec.cantidad_variacion)) AS cantidad',
        'SUM(ABS(rec.monto_variacion)) AS monto',
      ])
      .groupBy('rec.partida_id')
      .addGroupBy('rec.tipo');

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

    const rows = await query.getRawMany<{
      partida_id: string;
      tipo: string;
      cantidad: string;
      monto: string;
    }>();
    const map: AcumuladoMap = new Map();

    for (const row of rows) {
      const current = map.get(String(row.partida_id)) ?? this.emptyAcumulado();
      if (row.tipo === 'disminucion') {
        current.cantidadDisminucion += this.toNumber(row.cantidad);
        current.montoDisminucion += this.toNumber(row.monto);
      } else {
        current.cantidadAumento += this.toNumber(row.cantidad);
        current.montoAumento += this.toNumber(row.monto);
      }
      map.set(String(row.partida_id), current);
    }

    return map;
  }

  private emptyAcumulado() {
    return {
      cantidadAumento: 0,
      montoAumento: 0,
      cantidadDisminucion: 0,
      montoDisminucion: 0,
    };
  }

  private toNumber(value: string | number | null | undefined) {
    return Number.parseFloat(String(value ?? '0')) || 0;
  }
}
