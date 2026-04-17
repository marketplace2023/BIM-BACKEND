import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import {
  CreateCertificacionDto,
  CreateLineaCertificacionDto,
  AprobarCertificacionDto,
} from './dto/create-certificacion.dto';
import { SaveCertificacionDetallesDto } from './dto/save-certificacion-detalles.dto';
import { UpdateCertificacionDto } from './dto/update-certificacion.dto';

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

type AcumuladoValuacion = {
  cantidad: number;
  monto: number;
};

@Injectable()
export class CertificacionesService {
  constructor(
    @InjectRepository(BimCertificacion)
    private readonly certRepo: Repository<BimCertificacion>,
    @InjectRepository(BimLineaCertificacion)
    private readonly lineaRepo: Repository<BimLineaCertificacion>,
    @InjectRepository(BimMedicion)
    private readonly medicionRepo: Repository<BimMedicion>,
    @InjectRepository(BimMedicionDocumento)
    private readonly medicionDocumentoRepo: Repository<BimMedicionDocumento>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateCertificacionDto,
    userId: string,
    tenantId: string,
  ): Promise<BimCertificacion> {
    await this.findTenantObra(dto.obra_id, tenantId);
    const presupuesto = await this.findTenantPresupuesto(dto.presupuesto_id, tenantId);

    let medicionDocumentoId: string | null = null;
    let lineasPrecargadas: CreateLineaCertificacionDto[] = [];

    if (dto.medicion_documento_id) {
      const medicion = await this.findTenantMedicionDocumento(dto.medicion_documento_id, tenantId);
      if (String(medicion.obra_id) !== String(dto.obra_id)) {
        throw new BadRequestException('La medición no pertenece a la obra seleccionada');
      }
      if (String(medicion.presupuesto_id) !== String(presupuesto.id)) {
        throw new BadRequestException('La medición no pertenece al presupuesto seleccionado');
      }
      medicionDocumentoId = medicion.id;
      lineasPrecargadas = await this.buildLineasFromMedicion(medicion.id, presupuesto.id, tenantId);
    }

    return this.dataSource.transaction(async (manager) => {
      // Obtener el siguiente número correlativo por obra
      const lastCert = await manager.findOne(BimCertificacion, {
        where: { obra_id: dto.obra_id },
        order: { numero: 'DESC' },
      });
      const numero = (lastCert?.numero ?? 0) + 1;

      const cert = manager.create(BimCertificacion, {
        tenant_id: tenantId,
        obra_id: dto.obra_id,
        presupuesto_id: dto.presupuesto_id,
        medicion_documento_id: medicionDocumentoId,
        numero,
        periodo_desde: dto.periodo_desde as unknown as Date,
        periodo_hasta: dto.periodo_hasta as unknown as Date,
        observaciones: dto.observaciones,
        created_by: userId,
      });
      const saved = await manager.save(BimCertificacion, cert);

      const lineas = dto.lineas?.length ? dto.lineas : lineasPrecargadas;

      if (lineas.length) {
        await this.saveLineas(manager, saved.id, lineas);
        await this.recalcularTotales(manager, saved.id);
      }

      return saved;
    });
  }

  private async saveLineas(
    manager: any,
    certId: string,
    lineas: CreateLineaCertificacionDto[],
  ): Promise<void> {
    for (const l of lineas) {
      const cantAnt = parseFloat(l.cantidad_anterior);
      const cantAct = parseFloat(l.cantidad_actual);
      const cantAcum = cantAnt + cantAct;
      const pu = parseFloat(l.precio_unitario);
      const cantPres = parseFloat(l.cantidad_presupuesto);
      const porcentaje = cantPres > 0 ? (cantAcum / cantPres) * 100 : 0;

      const linea = manager.create(BimLineaCertificacion, {
        certificacion_id: certId,
        partida_id: l.partida_id,
        cantidad_presupuesto: l.cantidad_presupuesto,
        cantidad_anterior: l.cantidad_anterior,
        cantidad_actual: l.cantidad_actual,
        cantidad_acumulada: cantAcum.toFixed(4),
        precio_unitario: l.precio_unitario,
        importe_anterior: (cantAnt * pu).toFixed(2),
        importe_actual: (cantAct * pu).toFixed(2),
        importe_acumulado: (cantAcum * pu).toFixed(2),
        porcentaje: porcentaje.toFixed(2),
      });
      await manager.save(BimLineaCertificacion, linea);
    }
  }

  private async recalcularTotales(manager: any, certId: string): Promise<void> {
    const lineas = await manager.find(BimLineaCertificacion, {
      where: { certificacion_id: certId },
    });

    const totalAnterior = lineas.reduce(
      (s: number, l: BimLineaCertificacion) =>
        s + parseFloat(l.importe_anterior),
      0,
    );
    const totalActual = lineas.reduce(
      (s: number, l: BimLineaCertificacion) => s + parseFloat(l.importe_actual),
      0,
    );
    const totalAcumulado = lineas.reduce(
      (s: number, l: BimLineaCertificacion) =>
        s + parseFloat(l.importe_acumulado),
      0,
    );

    // Porcentaje global: importe_acumulado / sum(cantidad_presupuesto * precio_unitario)
    const totalPresupuestado = lineas.reduce(
      (s: number, l: BimLineaCertificacion) =>
        s + parseFloat(l.cantidad_presupuesto) * parseFloat(l.precio_unitario),
      0,
    );
    const porcentajeAvance =
      totalPresupuestado > 0 ? (totalAcumulado / totalPresupuestado) * 100 : 0;

    await manager.update(BimCertificacion, certId, {
      total_cert_anterior: totalAnterior.toFixed(2),
      total_cert_actual: totalActual.toFixed(2),
      total_cert_acumulado: totalAcumulado.toFixed(2),
      porcentaje_avance: porcentajeAvance.toFixed(2),
    });
  }

  async findByObra(
    obraId: string,
    tenantId: string,
    presupuestoId?: string,
  ): Promise<BimCertificacion[]> {
    await this.findTenantObra(obraId, tenantId);

    const where: { obra_id: string; tenant_id: string; presupuesto_id?: string } = {
      obra_id: obraId,
      tenant_id: tenantId,
    };

    if (presupuestoId) {
      where.presupuesto_id = presupuestoId;
    }

    return this.certRepo.find({
      where,
      order: { numero: 'DESC', created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const cert = await this.certRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'presupuesto', 'medicion_documento', 'creator', 'aprobador'],
    });
    if (!cert)
      throw new NotFoundException(`Certificación #${id} no encontrada`);

    const lineas = await this.lineaRepo.find({
      where: { certificacion_id: id },
      relations: ['partida'],
      order: { id: 'ASC' },
    });

    return { ...cert, lineas };
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateCertificacionDto,
  ): Promise<BimCertificacion> {
    const cert = await this.certRepo.findOneBy({ id, tenant_id: tenantId });
    if (!cert) {
      throw new NotFoundException(`Certificación #${id} no encontrada`);
    }
    if (cert.estado !== 'borrador') {
      throw new BadRequestException(
        'Solo se pueden editar valuaciones en borrador',
      );
    }

    if (dto.periodo_desde) cert.periodo_desde = dto.periodo_desde as unknown as Date;
    if (dto.periodo_hasta) cert.periodo_hasta = dto.periodo_hasta as unknown as Date;
    if (dto.medicion_documento_id !== undefined) {
      if (!dto.medicion_documento_id) {
        cert.medicion_documento_id = null;
      } else {
        const medicion = await this.findTenantMedicionDocumento(dto.medicion_documento_id, tenantId);
        if (String(medicion.obra_id) !== String(cert.obra_id)) {
          throw new BadRequestException('La medición no pertenece a la obra seleccionada');
        }
        if (String(medicion.presupuesto_id) !== String(cert.presupuesto_id)) {
          throw new BadRequestException('La medición no pertenece al presupuesto seleccionado');
        }
        cert.medicion_documento_id = medicion.id;
      }
    }
    if (dto.observaciones !== undefined) cert.observaciones = dto.observaciones || null;

    return this.certRepo.save(cert);
  }

  async getResumen(id: string, tenantId: string) {
    const cert = await this.certRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'presupuesto', 'medicion_documento', 'creator', 'aprobador'],
    });
    if (!cert) {
      throw new NotFoundException(`Certificación #${id} no encontrada`);
    }

    const partidas = await this.findPresupuestoPartidas(cert.presupuesto_id, tenantId);
    const acumuladosPrevios = await this.buildAcumuladosPrevios(cert, tenantId);
    const actuales = await this.lineaRepo.find({
      where: { certificacion_id: cert.id },
      order: { id: 'ASC' },
    });
    const actualesByPartida = new Map(actuales.map((item) => [String(item.partida_id), item]));

    const detalle = partidas.map((partida, index) => {
      const precioUnitario = this.toNumber(partida.precio_unitario);
      const cantidadPresupuesto = this.toNumber(partida.cantidad);
      const montoPresupuesto = this.toNumber(partida.importe_total);
      const previo = acumuladosPrevios.get(String(partida.id)) ?? { cantidad: 0, monto: 0 };
      const actual = actualesByPartida.get(String(partida.id));
      const cantidadActual = actual ? this.toNumber(actual.cantidad_actual) : 0;
      const cantidadAcumulada = previo.cantidad + cantidadActual;
      const montoActual = actual ? this.toNumber(actual.importe_actual) : cantidadActual * precioUnitario;
      const montoAcumulado = previo.monto + montoActual;
      const saldoCantidad = cantidadPresupuesto - cantidadAcumulada;
      const saldoMonto = montoPresupuesto - montoAcumulado;
      const porcentajeAvance = cantidadPresupuesto > 0 ? (cantidadAcumulada / cantidadPresupuesto) * 100 : 0;

      return {
        partida_id: partida.id,
        nro: index + 1,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        cantidad_presupuesto: cantidadPresupuesto.toFixed(4),
        cantidad_anterior: previo.cantidad.toFixed(4),
        cantidad_actual: cantidadActual.toFixed(4),
        cantidad_acumulada: cantidadAcumulada.toFixed(4),
        saldo_cantidad: saldoCantidad.toFixed(4),
        precio_unitario: precioUnitario.toFixed(4),
        monto_presupuesto: montoPresupuesto.toFixed(2),
        monto_anterior: previo.monto.toFixed(2),
        monto_actual: montoActual.toFixed(2),
        monto_acumulado: montoAcumulado.toFixed(2),
        saldo_monto: saldoMonto.toFixed(2),
        porcentaje_avance: porcentajeAvance.toFixed(2),
      };
    });

    const totalPresupuesto = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_presupuesto), 0);
    const totalAnterior = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_anterior), 0);
    const totalActual = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_actual), 0);
    const totalAcumulado = detalle.reduce((sum, item) => sum + this.toNumber(item.monto_acumulado), 0);
    const totalSaldo = detalle.reduce((sum, item) => sum + this.toNumber(item.saldo_monto), 0);
    const avanceGlobal = totalPresupuesto > 0 ? (totalAcumulado / totalPresupuesto) * 100 : 0;

    return {
      documento: cert,
      resumen: {
        presupuesto_base: totalPresupuesto.toFixed(2),
        valuado_anterior: totalAnterior.toFixed(2),
        valuado_actual: totalActual.toFixed(2),
        valuado_acumulado: totalAcumulado.toFixed(2),
        saldo_por_valorar: totalSaldo.toFixed(2),
        porcentaje_avance: avanceGlobal.toFixed(2),
      },
      detalle,
    };
  }

  async saveDetalles(
    id: string,
    tenantId: string,
    dto: SaveCertificacionDetallesDto,
  ) {
    const cert = await this.certRepo.findOneBy({ id, tenant_id: tenantId });
    if (!cert) {
      throw new NotFoundException(`Certificación #${id} no encontrada`);
    }
    if (cert.estado !== 'borrador') {
      throw new BadRequestException(
        'Solo se pueden editar valuaciones en borrador',
      );
    }

    const partidas = await this.findPresupuestoPartidas(cert.presupuesto_id, tenantId);
    const partidasMap = new Map(partidas.map((item) => [String(item.id), item]));
    const acumuladosPrevios = await this.buildAcumuladosPrevios(cert, tenantId);

    await this.dataSource.transaction(async (manager) => {
      const lineaRepo = manager.getRepository(BimLineaCertificacion);
      const existentes = await lineaRepo.find({
        where: { certificacion_id: cert.id },
      });
      const existentesByPartida = new Map(existentes.map((item) => [String(item.partida_id), item]));
      const payload = new Map(dto.detalles.map((item) => [String(item.partida_id), item]));

      for (const [partidaId, partida] of partidasMap.entries()) {
        const item = payload.get(partidaId);
        const cantidadActual = item ? Math.max(this.toNumber(item.cantidad_actual), 0) : 0;
        const existente = existentesByPartida.get(partidaId);

        if (cantidadActual <= 0) {
          if (existente) {
            await lineaRepo.remove(existente);
          }
          continue;
        }

        const previo = acumuladosPrevios.get(partidaId) ?? { cantidad: 0, monto: 0 };
        const precioUnitario = this.toNumber(partida.precio_unitario);
        const cantidadPresupuesto = this.toNumber(partida.cantidad);
        const cantidadAcumulada = previo.cantidad + cantidadActual;
        const importeActual = cantidadActual * precioUnitario;
        const importeAcumulado = previo.monto + importeActual;
        const porcentaje = cantidadPresupuesto > 0 ? (cantidadAcumulada / cantidadPresupuesto) * 100 : 0;

        const linea =
          existente ??
          lineaRepo.create({
            certificacion_id: cert.id,
            partida_id: partidaId,
          });

        linea.certificacion_id = cert.id;
        linea.partida_id = partidaId;
        linea.cantidad_presupuesto = cantidadPresupuesto.toFixed(4);
        linea.cantidad_anterior = previo.cantidad.toFixed(4);
        linea.cantidad_actual = cantidadActual.toFixed(4);
        linea.cantidad_acumulada = cantidadAcumulada.toFixed(4);
        linea.precio_unitario = precioUnitario.toFixed(4);
        linea.importe_anterior = previo.monto.toFixed(2);
        linea.importe_actual = importeActual.toFixed(2);
        linea.importe_acumulado = importeAcumulado.toFixed(2);
        linea.porcentaje = porcentaje.toFixed(2);

        await lineaRepo.save(linea);
      }

      await this.recalcularTotales(manager, cert.id);
    });

    return this.getResumen(cert.id, tenantId);
  }

  async cambiarEstado(
    id: string,
    dto: AprobarCertificacionDto,
    userId: string,
    tenantId: string,
  ): Promise<BimCertificacion> {
    const cert = await this.certRepo.findOneBy({ id, tenant_id: tenantId });
    if (!cert)
      throw new NotFoundException(`Certificación #${id} no encontrada`);

    const flujo: Record<string, string[]> = {
      borrador: ['revisada'],
      revisada: ['aprobada', 'borrador'],
      aprobada: ['facturada'],
      facturada: [],
    };

    if (!flujo[cert.estado]?.includes(dto.estado)) {
      throw new BadRequestException(
        `No se puede pasar de "${cert.estado}" a "${dto.estado}"`,
      );
    }

    cert.estado = dto.estado;
    if (dto.observaciones) cert.observaciones = dto.observaciones;
    if (dto.estado === 'aprobada') {
      cert.aprobado_por = userId;
      cert.fecha_aprobacion = new Date();
    }
    return this.certRepo.save(cert);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const cert = await this.certRepo.findOneBy({ id, tenant_id: tenantId });
    if (!cert)
      throw new NotFoundException(`Certificación #${id} no encontrada`);
    if (cert.estado !== 'borrador') {
      throw new BadRequestException(
        'Solo se pueden eliminar certificaciones en borrador',
      );
    }
    await this.certRepo.remove(cert);
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
    if (!presupuesto)
      throw new NotFoundException(`Presupuesto #${id} no encontrado`);
    return presupuesto;
  }

  private async findTenantMedicionDocumento(id: string, tenantId: string) {
    const medicion = await this.medicionDocumentoRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!medicion) {
      throw new NotFoundException(`Documento de medición #${id} no encontrado`);
    }
    return medicion;
  }

  private async findPresupuestoPartidas(
    presupuestoId: string,
    tenantId: string,
  ): Promise<PartidaBaseRow[]> {
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

  private async buildAcumuladosPrevios(
    cert: BimCertificacion,
    tenantId: string,
  ) {
    const rows = await this.lineaRepo
      .createQueryBuilder('linea')
      .innerJoin(BimCertificacion, 'cert', 'cert.id = linea.certificacion_id')
      .where('cert.tenant_id = :tenantId', { tenantId })
      .andWhere('cert.presupuesto_id = :presupuestoId', {
        presupuestoId: cert.presupuesto_id,
      })
      .andWhere(
        '(cert.numero < :numero OR (cert.numero = :numero AND cert.id < :id))',
        { numero: cert.numero, id: cert.id },
      )
      .select('linea.partida_id', 'partida_id')
      .addSelect('SUM(linea.cantidad_actual)', 'cantidad')
      .addSelect('SUM(linea.importe_actual)', 'monto')
      .groupBy('linea.partida_id')
      .getRawMany<{ partida_id: string; cantidad?: string; monto?: string }>();

    return new Map<string, AcumuladoValuacion>(
      rows.map((row) => [
        String(row.partida_id),
        {
          cantidad: this.toNumber(row.cantidad ?? '0'),
          monto: this.toNumber(row.monto ?? '0'),
        },
      ]),
    );
  }

  private async buildLineasFromMedicion(
    medicionDocumentoId: string,
    presupuestoId: string,
    tenantId: string,
  ): Promise<CreateLineaCertificacionDto[]> {
    const partidas = await this.findPresupuestoPartidas(presupuestoId, tenantId);
    const mediciones = await this.medicionRepo.find({
      where: { documento_id: medicionDocumentoId, tenant_id: tenantId },
      order: { id: 'ASC' },
    });

    const medicionesByPartida = new Map(
      mediciones.map((item) => [String(item.partida_id), item]),
    );

    return partidas
      .map((partida) => {
        const medicion = medicionesByPartida.get(String(partida.id));
        if (!medicion) return null;

        return {
          partida_id: String(partida.id),
          cantidad_presupuesto: String(partida.cantidad),
          cantidad_anterior: String(medicion.cantidad_anterior ?? '0'),
          cantidad_actual: String(medicion.cantidad_actual ?? '0'),
          precio_unitario: String(partida.precio_unitario),
        } satisfies CreateLineaCertificacionDto;
      })
      .filter(
        (item): item is CreateLineaCertificacionDto =>
          item !== null && this.toNumber(item.cantidad_actual) > 0,
      );
  }

  private toNumber(value: string | number | null | undefined) {
    return Number.parseFloat(String(value ?? '0')) || 0;
  }
}
