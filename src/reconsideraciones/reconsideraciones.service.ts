import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { CreateReconsideracionDocumentoDto } from './dto/create-reconsideracion-documento.dto';
import { UpdateReconsideracionDocumentoDto } from './dto/update-reconsideracion-documento.dto';
import { SaveReconsideracionDetallesDto } from './dto/save-reconsideracion-detalles.dto';
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

type AcumuladoMap = Map<
  string,
  { cantidadAumento: number; montoAumento: number; cantidadDisminucion: number; montoDisminucion: number }
>;

type ReconsideracionPrecioBaseRow = {
  partida_id: string;
  cantidad_base: number;
  monto_base: number;
};

@Injectable()
export class ReconsideracionesService {
  constructor(
    @InjectRepository(BimCertificacion)
    private readonly certificacionRepo: Repository<BimCertificacion>,
    @InjectRepository(BimLineaCertificacion)
    private readonly lineaCertRepo: Repository<BimLineaCertificacion>,
    @InjectRepository(BimCapitulo)
    private readonly capituloRepo: Repository<BimCapitulo>,
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
    let certificacionId: string | null = null;

    if (tipo === 'precio' && dto.certificacion_id) {
      const certificacion = await this.findTenantCertificacion(dto.certificacion_id, tenantId);
      if (String(certificacion.obra_id) !== String(obra.id)) {
        throw new BadRequestException('La valuación no pertenece a la obra seleccionada');
      }
      if (String(certificacion.presupuesto_id) !== String(presupuesto.id)) {
        throw new BadRequestException('La valuación no pertenece al presupuesto seleccionado');
      }
      certificacionId = certificacion.id;
    }

    const numero = await this.nextNumero(tenantId, presupuesto.id, tipo);
    const fecha = dto.fecha ? dto.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const titulo =
      dto.titulo?.trim() ||
      (tipo === 'aumento'
        ? `PRESUPUESTO DE AUMENTOS Nro. ${numero}`
        : tipo === 'disminucion'
          ? `PRESUPUESTO DE DISMINUCIONES Nro. ${numero}`
          : tipo === 'extra'
            ? `PRESUPUESTO DE OBRAS EXTRAS Nro. ${numero}`
          : `RECONSIDERACION DE PRECIOS Nro. ${numero}`);

    return this.documentoRepo.save(
      this.documentoRepo.create({
        tenant_id: tenantId,
        obra_id: obra.id,
        presupuesto_id: presupuesto.id,
        certificacion_id: certificacionId,
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
      relations: ['presupuesto', 'certificacion', 'creador', 'aprobador'],
      order: { numero: 'DESC', created_at: 'DESC' },
    });
  }

  async findDocumento(id: string, tenantId: string) {
    const documento = await this.documentoRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'presupuesto', 'certificacion', 'creador', 'aprobador'],
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
      if (documento.tipo !== 'precio') {
        documento.certificacion_id = null;
      }
    }

    if (dto.tipo && dto.tipo !== documento.tipo) {
      throw new BadRequestException('No se puede cambiar el tipo del documento');
    }

    if (documento.tipo === 'precio' && dto.certificacion_id !== undefined) {
      if (!dto.certificacion_id) {
        documento.certificacion_id = null;
      } else {
        const certificacion = await this.findTenantCertificacion(dto.certificacion_id, tenantId);
        if (String(certificacion.obra_id) !== String(documento.obra_id)) {
          throw new BadRequestException('La valuación no pertenece a la obra seleccionada');
        }
        if (String(certificacion.presupuesto_id) !== String(documento.presupuesto_id)) {
          throw new BadRequestException('La valuación no pertenece al presupuesto seleccionado');
        }
        documento.certificacion_id = certificacion.id;
      }
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

    return this.documentoRepo.save(documento);
  }

  async getDocumentoResumen(id: string, tenantId: string) {
    const documento = await this.findDocumento(id, tenantId);
    if (documento.tipo === 'precio') {
      return this.getDocumentoPrecioResumen(documento, tenantId);
    }
    if (documento.tipo === 'extra') {
      return this.getDocumentoExtrasResumen(documento, tenantId);
    }

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
      const disminucionActual = actual && actual.tipo === 'disminucion' ? Math.abs(this.toNumber(actual.cantidad_variacion)) : 0;
      const montoDisminucionActual = actual && actual.tipo === 'disminucion' ? this.toNumber(actual.monto_variacion) : 0;
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
        disminucion_actual: disminucionActual.toFixed(4),
        monto_disminucion_actual: montoDisminucionActual.toFixed(2),
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
    const totalDisminucionesActuales = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_disminucion_actual), 0);
    const totalDisminucionesPrevias = detalle.reduce((sum, item) => sum + (this.toNumber(item.total_disminucion_acumulada) - this.toNumber(item.monto_disminucion_actual)), 0);
    const totalDisminuciones = totalDisminucionesPrevias + totalDisminucionesActuales;
    const totalModificado = detalle.reduce((sum, item) => sum + this.toNumber(item.total_modificado), 0);

    return {
      documento,
      resumen: {
        original: totalOriginal.toFixed(2),
        extras: '0.00',
        aumentos_anteriores: totalAumentosPrevios.toFixed(2),
        aumentos_actuales: totalAumentosActuales.toFixed(2),
        aumentos_acumulados: (totalAumentosPrevios + totalAumentosActuales).toFixed(2),
        disminuciones_anteriores: totalDisminucionesPrevias.toFixed(2),
        disminuciones_actuales: totalDisminucionesActuales.toFixed(2),
        disminuciones_acumuladas: totalDisminuciones.toFixed(2),
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
    if (documento.tipo === 'precio') {
      return this.saveDocumentoPrecioDetalles(documento, userId, tenantId, dto);
    }
    if (documento.tipo === 'extra') {
      return this.saveDocumentoExtraDetalles(documento, userId, tenantId, dto);
    }

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

  private async findTenantCertificacion(id: string, tenantId: string) {
    const certificacion = await this.certificacionRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!certificacion) {
      throw new NotFoundException(`Valuación #${id} no encontrada`);
    }
    return certificacion;
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
        'partida.es_extra AS es_extra',
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

  private async getDocumentoPrecioResumen(
    documento: BimReconsideracionDocumento,
    tenantId: string,
  ) {
    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const baseByPartida = await this.buildBasePrecioMap(documento, tenantId);
    const actuales = await this.reconsideracionRepo.find({
      where: { documento_id: documento.id, tenant_id: tenantId },
      order: { id: 'ASC' },
    });
    const actualesByPartida = new Map(actuales.map((item) => [String(item.partida_id), item]));

    const detalle = partidas.map((partida, index) => {
      const base = baseByPartida.get(String(partida.id)) ?? {
        partida_id: String(partida.id),
        cantidad_base: this.toNumber(partida.cantidad),
        monto_base: this.toNumber(partida.importe_total),
      };
      const actual = actualesByPartida.get(String(partida.id));
      const precioOriginal = this.toNumber(partida.precio_unitario);
      const precioReconsiderado = actual
        ? this.toNumber(actual.precio_unitario_reconsiderado)
        : precioOriginal;
      const cantidadBase = base.cantidad_base;
      const montoBase = base.monto_base;
      const montoReconsiderado = cantidadBase * precioReconsiderado;
      const diferencial = montoReconsiderado - montoBase;

      return {
        partida_id: partida.id,
        nro: index + 1,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        cantidad_base: cantidadBase.toFixed(4),
        precio_unitario_original: precioOriginal.toFixed(4),
        precio_unitario_reconsiderado: precioReconsiderado.toFixed(4),
        monto_base: montoBase.toFixed(2),
        monto_reconsiderado: montoReconsiderado.toFixed(2),
        diferencial: diferencial.toFixed(2),
        justificacion: actual?.justificacion ?? null,
      };
    });

    const totalBase = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_base), 0);
    const totalReconsiderado = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_reconsiderado), 0);
    const totalDiferencial = detalle.reduce((sum, item) => sum + this.toNumber(item.diferencial), 0);

    return {
      documento,
      resumen: {
        base: totalBase.toFixed(2),
        reconsiderado: totalReconsiderado.toFixed(2),
        diferencial: totalDiferencial.toFixed(2),
        fuente: documento.certificacion_id ? 'valuacion' : 'presupuesto',
      },
      detalle,
    };
  }

  private async getDocumentoExtrasResumen(
    documento: BimReconsideracionDocumento,
    tenantId: string,
  ) {
    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const extras = partidas.filter((partida: any) => Number(partida.es_extra ?? 0) === 1);
    const actuales = await this.reconsideracionRepo.find({
      where: { documento_id: documento.id, tenant_id: tenantId },
      order: { id: 'ASC' },
    });
    const actualesByPartida = new Map(actuales.map((item) => [String(item.partida_id), item]));

    const detalle = extras.map((partida: any, index) => {
      const actual = actualesByPartida.get(String(partida.id));
      const cantidad = actual ? this.toNumber(actual.cantidad_variacion) : this.toNumber(partida.cantidad);
      const precioUnitario = actual ? this.toNumber(actual.precio_unitario) : this.toNumber(partida.precio_unitario);
      const monto = cantidad * precioUnitario;

      return {
        partida_id: partida.id,
        capitulo_id: null,
        nro: index + 1,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        cantidad_extra: cantidad.toFixed(4),
        precio_unitario: precioUnitario.toFixed(4),
        monto_extra: monto.toFixed(2),
        justificacion: actual?.justificacion ?? null,
      };
    });

    const totalExtras = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_extra), 0);
    const presupuesto = await this.findTenantPresupuesto(documento.presupuesto_id, tenantId);
    const aumentos = await this.sumMontoByTipo(documento.presupuesto_id, tenantId, 'aumento');
    const disminuciones = await this.sumMontoByTipo(documento.presupuesto_id, tenantId, 'disminucion');

    return {
      documento,
      resumen: {
        original: presupuesto.total_presupuesto,
        extras: totalExtras.toFixed(2),
        aumentos: aumentos.toFixed(2),
        disminuciones: disminuciones.toFixed(2),
        modificado: (this.toNumber(presupuesto.total_presupuesto) + totalExtras + aumentos - disminuciones).toFixed(2),
      },
      detalle,
    };
  }

  private async saveDocumentoPrecioDetalles(
    documento: BimReconsideracionDocumento,
    userId: string,
    tenantId: string,
    dto: SaveReconsideracionDetallesDto,
  ) {
    if (documento.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar documentos en borrador');
    }

    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const partidasMap = new Map(partidas.map((item) => [String(item.id), item]));
    const baseByPartida = await this.buildBasePrecioMap(documento, tenantId);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BimReconsideracion);
      const existentes = await repo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
      });
      const existentesByPartida = new Map(existentes.map((item) => [String(item.partida_id), item]));
      const payload = new Map(dto.detalles.map((item) => [String(item.partida_id), item]));

      for (const [partidaId, partida] of partidasMap.entries()) {
        const item = payload.get(partidaId);
        const existente = existentesByPartida.get(partidaId);
        const cantidadBase = (baseByPartida.get(partidaId)?.cantidad_base ?? this.toNumber(partida.cantidad));
        const precioOriginal = this.toNumber(partida.precio_unitario);
        const precioReconsiderado = item?.precio_unitario_reconsiderado
          ? Math.max(this.toNumber(item.precio_unitario_reconsiderado), 0)
          : precioOriginal;
        const montoBase = cantidadBase * precioOriginal;
        const montoReconsiderado = cantidadBase * precioReconsiderado;
        const diferencial = montoReconsiderado - montoBase;

        if (Math.abs(precioReconsiderado - precioOriginal) < 0.0001) {
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
          tipo: 'precio',
          descripcion: partida.descripcion,
          cantidad_original: cantidadBase.toFixed(4),
          cantidad_variacion: '0.0000',
          cantidad_nueva: cantidadBase.toFixed(4),
          precio_unitario: precioOriginal.toFixed(4),
          precio_unitario_reconsiderado: precioReconsiderado.toFixed(4),
          monto_variacion: diferencial.toFixed(2),
          justificacion: item?.justificacion ?? null,
          status: 'borrador',
        });

        await repo.save(row);
      }
    });

    return this.getDocumentoPrecioResumen(documento, tenantId);
  }

  private async saveDocumentoExtraDetalles(
    documento: BimReconsideracionDocumento,
    userId: string,
    tenantId: string,
    dto: SaveReconsideracionDetallesDto,
  ) {
    if (documento.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar documentos en borrador');
    }

    const presupuesto = await this.findTenantPresupuesto(documento.presupuesto_id, tenantId);
    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuesto.id },
      order: { orden: 'ASC', id: 'ASC' },
    });

    if (!capitulos.length) {
      throw new BadRequestException('El presupuesto no tiene capítulos para registrar obras extras');
    }

    await this.dataSource.transaction(async (manager) => {
      const recRepo = manager.getRepository(BimReconsideracion);
      const partidaRepo = manager.getRepository(BimPartida);
      const existentes = await recRepo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
      });
      const existentesByPartida = new Map(existentes.map((item) => [String(item.partida_id), item]));

      for (const item of dto.detalles) {
        const cantidad = Math.max(this.toNumber(item.cantidad_variacion), 0);
        const precioUnitario = Math.max(this.toNumber(item.precio_unitario), 0);
        const codigo = item.codigo?.trim();
        const descripcion = item.descripcion?.trim();
        const unidad = item.unidad?.trim();

        if (!codigo || !descripcion || !unidad || cantidad <= 0 || precioUnitario <= 0) {
          continue;
        }

        let partida: BimPartida | null = null;

        if (item.partida_id) {
          partida = await partidaRepo.findOne({ where: { id: item.partida_id } });
        }

        const capituloId = item.capitulo_id || capitulos[0]?.id;
        if (!partida) {
          partida = partidaRepo.create({
            capitulo_id: capituloId,
            codigo,
            descripcion,
            unidad,
            cantidad: cantidad.toFixed(4),
            precio_unitario: precioUnitario.toFixed(4),
            observaciones: item.justificacion ?? null,
            es_extra: 1,
            orden: 999,
          });
        } else {
          partida.codigo = codigo;
          partida.descripcion = descripcion;
          partida.unidad = unidad;
          partida.cantidad = cantidad.toFixed(4);
          partida.precio_unitario = precioUnitario.toFixed(4);
          partida.observaciones = item.justificacion ?? partida.observaciones;
          partida.es_extra = 1;
        }

        const savedPartida = await partidaRepo.save(partida);
        const existente = existentesByPartida.get(String(savedPartida.id));
        const row =
          existente ??
          recRepo.create({
            tenant_id: tenantId,
            obra_id: documento.obra_id,
            documento_id: documento.id,
            partida_id: savedPartida.id,
            created_by: userId,
            approved_by: null,
            approved_at: null,
            status: 'borrador',
          });

        Object.assign(row, {
          tenant_id: tenantId,
          obra_id: documento.obra_id,
          documento_id: documento.id,
          partida_id: savedPartida.id,
          tipo: 'extra',
          descripcion: savedPartida.descripcion,
          cantidad_original: '0.0000',
          cantidad_variacion: cantidad.toFixed(4),
          cantidad_nueva: cantidad.toFixed(4),
          precio_unitario: precioUnitario.toFixed(4),
          precio_unitario_reconsiderado: '0.0000',
          monto_variacion: (cantidad * precioUnitario).toFixed(2),
          justificacion: item.justificacion ?? null,
          status: 'borrador',
        });

        await recRepo.save(row);
      }

      await this.recalcularPresupuesto(manager, presupuesto.id, tenantId);
    });

    return this.getDocumentoExtrasResumen(documento, tenantId);
  }

  private async buildBasePrecioMap(
    documento: BimReconsideracionDocumento,
    tenantId: string,
  ) {
    if (!documento.certificacion_id) {
      const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
      return new Map<string, ReconsideracionPrecioBaseRow>(
        partidas.map((partida) => [
          String(partida.id),
          {
            partida_id: String(partida.id),
            cantidad_base: this.toNumber(partida.cantidad),
            monto_base: this.toNumber(partida.importe_total),
          },
        ]),
      );
    }

    await this.findTenantCertificacion(documento.certificacion_id, tenantId);
    const lineas = await this.lineaCertRepo.find({
      where: { certificacion_id: documento.certificacion_id },
    });

    return new Map<string, ReconsideracionPrecioBaseRow>(
      lineas.map((linea) => [
        String(linea.partida_id),
        {
          partida_id: String(linea.partida_id),
          cantidad_base: this.toNumber(linea.cantidad_actual),
          monto_base: this.toNumber(linea.importe_actual),
        },
      ]),
    );
  }

  private async sumMontoByTipo(
    presupuestoId: string,
    tenantId: string,
    tipo: 'aumento' | 'disminucion',
  ) {
    const result = await this.reconsideracionRepo
      .createQueryBuilder('rec')
      .innerJoin(BimReconsideracionDocumento, 'doc', 'doc.id = rec.documento_id')
      .where('doc.tenant_id = :tenantId', { tenantId })
      .andWhere('doc.presupuesto_id = :presupuestoId', { presupuestoId })
      .andWhere('doc.tipo = :tipo', { tipo })
      .select('SUM(ABS(rec.monto_variacion))', 'total')
      .getRawOne<{ total?: string }>();

    return this.toNumber(result?.total ?? '0');
  }

  private async recalcularPresupuesto(manager: any, presupuestoId: string, tenantId: string) {
    const partidaRepo = manager.getRepository(BimPartida);
    const presupuestoRepo = manager.getRepository(BimPresupuesto);

    const result = await partidaRepo
      .createQueryBuilder('p')
      .innerJoin('bim_capitulos', 'c', 'c.id = p.capitulo_id')
      .where('c.presupuesto_id = :presupuestoId', { presupuestoId })
      .select('SUM(p.importe_total)', 'total')
      .getRawOne();

    const presupuesto = await presupuestoRepo.findOne({
      where: { id: presupuestoId, tenant_id: tenantId },
    });

    if (!presupuesto) {
      throw new NotFoundException(`Presupuesto #${presupuestoId} no encontrado`);
    }

    const totalPartidas = this.toNumber((result as { total?: string } | null)?.total ?? '0');
    const gastosIndirectos = this.toNumber(presupuesto.gastos_indirectos_pct) / 100;
    const beneficio = this.toNumber(presupuesto.beneficio_pct) / 100;
    const iva = this.toNumber(presupuesto.iva_pct) / 100;

    presupuesto.total_presupuesto = (
      totalPartidas * (1 + gastosIndirectos + beneficio) * (1 + iva)
    ).toFixed(2);

    await presupuestoRepo.save(presupuesto);
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
