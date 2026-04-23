import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument = require('pdfkit');
import { Repository } from 'typeorm';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimComputo } from '../database/entities/bim/bim-computo.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import { ComputosService } from '../computos/computos.service';
import { MemoriasService } from '../memorias/memorias.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import { ReconsideracionesService } from '../reconsideraciones/reconsideraciones.service';

type CloseoutRow = {
  capitulo: string;
  partida: string;
  unidad: string;
  presupuestoCantidad: number;
  computado: number;
  medido: number;
  montoPresupuesto: number;
  montoValuado: number;
};

const MEDICION_STATUSES_FOR_REPORTS = ['revisado', 'aprobado'] as const;
const CERTIFICACION_STATUSES_FOR_REPORTS = ['revisada', 'aprobada', 'facturada'] as const;
const RECONSIDERACION_STATUSES_FOR_REPORTS = ['revisado', 'aprobado'] as const;

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    @InjectRepository(BimCapitulo)
    private readonly capituloRepo: Repository<BimCapitulo>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
    @InjectRepository(BimComputo)
    private readonly computoRepo: Repository<BimComputo>,
    @InjectRepository(BimMedicion)
    private readonly medicionRepo: Repository<BimMedicion>,
    @InjectRepository(BimMedicionDocumento)
    private readonly medicionDocumentoRepo: Repository<BimMedicionDocumento>,
    @InjectRepository(BimCertificacion)
    private readonly certificacionRepo: Repository<BimCertificacion>,
    @InjectRepository(BimLineaCertificacion)
    private readonly lineaCertRepo: Repository<BimLineaCertificacion>,
    @InjectRepository(BimReconsideracion)
    private readonly reconsideracionRepo: Repository<BimReconsideracion>,
    @InjectRepository(BimReconsideracionDocumento)
    private readonly reconsideracionDocumentoRepo: Repository<BimReconsideracionDocumento>,
    @InjectRepository(BimRecurso)
    private readonly recursoRepo: Repository<BimRecurso>,
    private readonly computosService: ComputosService,
    private readonly memoriasService: MemoriasService,
    private readonly presupuestosService: PresupuestosService,
    private readonly reconsideracionesService: ReconsideracionesService,
  ) {}

  async getComparativo(
    tenantId: string,
    obraId: string,
    presupuestoId: string,
  ) {
    const obra = await this.obraRepo.findOne({ where: { id: obraId, tenant_id: tenantId } });
    if (!obra) throw new NotFoundException('Obra no encontrada');

    const presupuesto = await this.presupuestoRepo.findOne({
      where: { id: presupuestoId, tenant_id: tenantId },
    });
    if (!presupuesto) throw new NotFoundException('Presupuesto no encontrado');

    const presupuestoBase =
      presupuesto.tipo === 'modificado' && presupuesto.presupuesto_base_id
        ? await this.presupuestoRepo.findOne({
            where: {
              id: presupuesto.presupuesto_base_id,
              tenant_id: tenantId,
            },
          })
        : presupuesto;
    if (!presupuestoBase) {
      throw new NotFoundException('Presupuesto base no encontrado');
    }

    const modificadoSnapshot = await this.presupuestosService.getPresupuestoModificado(
      presupuestoBase.id,
      tenantId,
    );

    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuestoBase.id },
      order: { orden: 'ASC', id: 'ASC' },
    });

    const partidas = (
      await Promise.all(
        capitulos.map(async (capitulo) => {
          const rows = await this.partidaRepo.find({
            where: { capitulo_id: capitulo.id },
            order: { orden: 'ASC', id: 'ASC' },
          });
          return rows.map((partida) => ({ partida, capitulo }));
        }),
      )
    ).flat();

    const computos = await this.computoRepo.find({ where: { obra_id: obraId, tenant_id: tenantId } });
    const mediciones = await this.medicionRepo
      .createQueryBuilder('medicion')
      .innerJoin(BimMedicionDocumento, 'documento', 'documento.id = medicion.documento_id')
      .where('medicion.tenant_id = :tenantId', { tenantId })
      .andWhere('medicion.obra_id = :obraId', { obraId })
      .andWhere('documento.status IN (:...statuses)', {
        statuses: [...MEDICION_STATUSES_FOR_REPORTS],
      })
      .getMany();
    const valuaciones = await this.lineaCertRepo
      .createQueryBuilder('linea')
      .innerJoin(BimCertificacion, 'cert', 'cert.id = linea.certificacion_id')
      .where('cert.tenant_id = :tenantId', { tenantId })
      .andWhere('cert.obra_id = :obraId', { obraId })
      .andWhere('cert.estado IN (:...statuses)', {
        statuses: [...CERTIFICACION_STATUSES_FOR_REPORTS],
      })
      .getMany();
    const reconsideracionPrecios = await this.reconsideracionRepo
      .createQueryBuilder('rec')
      .innerJoin(BimReconsideracionDocumento, 'doc', 'doc.id = rec.documento_id')
      .where('doc.tenant_id = :tenantId', { tenantId })
      .andWhere('doc.presupuesto_id = :presupuestoId', {
        presupuestoId: presupuestoBase.id,
      })
      .andWhere('doc.tipo = :tipo', { tipo: 'precio' })
      .andWhere('doc.status IN (:...statuses)', {
        statuses: [...RECONSIDERACION_STATUSES_FOR_REPORTS],
      })
      .getMany();
    const computosMap = new Map<string, number>();
    const medicionesMap = new Map<string, number>();
    const valuacionesMap = new Map<string, number>();
    const reconsideracionPrecioMap = new Map<string, number>();
    const modificadoMap = new Map(
      modificadoSnapshot.detalle.map((item) => [String(item.partida_base_id), item]),
    );

    for (const item of computos) {
      computosMap.set(String(item.partida_id), Number(item.resultado ?? 0));
    }
    for (const item of mediciones) {
      medicionesMap.set(String(item.partida_id), Number(item.cantidad_acumulada ?? 0));
    }
    for (const item of valuaciones) {
      valuacionesMap.set(String(item.partida_id), Number(item.cantidad_acumulada ?? 0));
    }
    for (const item of reconsideracionPrecios) {
      const partidaId = String(item.partida_id);
      reconsideracionPrecioMap.set(
        partidaId,
        (reconsideracionPrecioMap.get(partidaId) ?? 0) +
          Number(item.monto_variacion ?? 0),
      );
    }

    const formalizacion = await this.getFormalizacionResumen(
      tenantId,
      obraId,
      presupuestoBase.id,
    );

    const detalleBase = partidas.map(({ partida, capitulo }, index) => {
      const modificado = modificadoMap.get(String(partida.id));
      const baseCantidad = Number(partida.cantidad ?? 0);
      const extras = Number(modificado?.cantidad_extra ?? 0);
      const aumentos = Number(modificado?.cantidad_aumento ?? 0);
      const disminuciones = Number(modificado?.cantidad_disminucion ?? 0);
      const modificada = Number(modificado?.cantidad_modificada ?? baseCantidad);
      const computado = computosMap.get(String(partida.id)) ?? 0;
      const medido = medicionesMap.get(String(partida.id)) ?? 0;
      const valuado = valuacionesMap.get(String(partida.id)) ?? 0;
      const reconsideracionDiferencial =
        reconsideracionPrecioMap.get(String(partida.id)) ?? 0;
      const precioUnitario = Number(partida.precio_unitario ?? 0);

      return {
        nro: index + 1,
        capitulo: `${capitulo.codigo} · ${capitulo.nombre}`,
        partida_id: partida.id,
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        precio_unitario: precioUnitario.toFixed(4),
        presupuesto_original: baseCantidad.toFixed(4),
        extras: extras.toFixed(4),
        aumentos: aumentos.toFixed(4),
        disminuciones: disminuciones.toFixed(4),
        presupuesto_modificado: modificada.toFixed(4),
        computado: computado.toFixed(4),
        medido: medido.toFixed(4),
        valuado: valuado.toFixed(4),
        reconsideracion_diferencial: reconsideracionDiferencial.toFixed(2),
        monto_original: (baseCantidad * precioUnitario).toFixed(2),
        monto_modificado: (modificada * precioUnitario).toFixed(2),
        monto_valuado: (valuado * precioUnitario).toFixed(2),
        monto_valuado_reconsiderado: (
          valuado * precioUnitario + reconsideracionDiferencial
        ).toFixed(2),
      };
    });

    const detalleExtras = modificadoSnapshot.detalle
      .filter((item) => Number(item.es_extra) === 1)
      .map((item, index) => ({
        nro: detalleBase.length + index + 1,
        capitulo: `${item.capitulo_codigo} · ${item.capitulo_nombre}`,
        partida_id: item.partida_base_id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad: item.unidad,
        precio_unitario: item.precio_unitario,
        presupuesto_original: item.cantidad_original,
        extras: item.cantidad_extra,
        aumentos: item.cantidad_aumento,
        disminuciones: item.cantidad_disminucion,
        presupuesto_modificado: item.cantidad_modificada,
        computado: '0.0000',
        medido: medicionesMap.get(String(item.partida_base_id))?.toFixed(4) ?? '0.0000',
        valuado: valuacionesMap.get(String(item.partida_base_id))?.toFixed(4) ?? '0.0000',
        reconsideracion_diferencial: '0.00',
        monto_original: item.monto_original,
        monto_modificado: item.monto_modificado,
        monto_valuado: ((valuacionesMap.get(String(item.partida_base_id)) ?? 0) * Number(item.precio_unitario)).toFixed(2),
        monto_valuado_reconsiderado: ((valuacionesMap.get(String(item.partida_base_id)) ?? 0) * Number(item.precio_unitario)).toFixed(2),
      }));

    const detalle = [...detalleBase, ...detalleExtras];
    const reconsideracionDiferencial = this.sumBy(
      detalle,
      'reconsideracion_diferencial',
    ).toFixed(2);
    const valuadoReconsiderado = this.sumBy(
      detalle,
      'monto_valuado_reconsiderado',
    ).toFixed(2);

    return {
      obra,
      presupuesto: presupuestoBase,
      presupuesto_modificado: modificadoSnapshot.presupuesto_modificado,
      original_oficial: modificadoSnapshot.original_oficial,
      trazabilidad_modificado: modificadoSnapshot.fuentes,
      summary: {
        original: modificadoSnapshot.resumen.original,
        modificado: modificadoSnapshot.resumen.modificado,
        valuado: this.sumBy(detalle, 'monto_valuado').toFixed(2),
        valuado_reconsiderado: valuadoReconsiderado,
        reconsideracion_diferencial: reconsideracionDiferencial,
        computado: this.sumBy(detalle, 'computado').toFixed(4),
        medido: this.sumBy(detalle, 'medido').toFixed(4),
        cantidad_modificada: this.sumBy(detalle, 'presupuesto_modificado').toFixed(4),
        variaciones: {
          extras: modificadoSnapshot.resumen.extras,
          aumentos: modificadoSnapshot.resumen.aumentos,
          disminuciones: modificadoSnapshot.resumen.disminuciones,
        },
        formalizacion,
      },
      detalle,
    };
  }

  async getCierre(
    tenantId: string,
    obraId: string,
    presupuestoId: string,
  ) {
    const comparativo = await this.getComparativo(tenantId, obraId, presupuestoId);
    const presupuesto = comparativo.presupuesto;
    const obra = comparativo.obra;

    const modificado = Number(comparativo.summary.modificado ?? 0);
    const reconsideracionDiferencial = Number(
      comparativo.summary.reconsideracion_diferencial ?? 0,
    );
    const economicoAjustado = modificado + reconsideracionDiferencial;
    const valuadoReconsiderado = Number(
      comparativo.summary.valuado_reconsiderado ?? 0,
    );
    const diferenciaEconomica = economicoAjustado - valuadoReconsiderado;

    const cantidadModificada = Number(comparativo.summary.cantidad_modificada ?? 0);
    const medido = Number(comparativo.summary.medido ?? 0);
    const diferenciaFisica = cantidadModificada - medido;
    const documentosPendientes =
      (comparativo.summary.formalizacion?.mediciones_borrador ?? 0) +
      (comparativo.summary.formalizacion?.valuaciones_borrador ?? 0) +
      (comparativo.summary.formalizacion?.reconsideraciones_borrador ?? 0);

    const estadoCierre =
      documentosPendientes > 0
        ? 'pendiente_formalizacion'
        : Math.abs(diferenciaEconomica) < 0.01 && Math.abs(diferenciaFisica) < 0.0001
        ? 'listo_para_cerrar'
        : 'con_diferencias';

    return {
      obra: {
        id: obra.id,
        codigo: obra.codigo,
        nombre: obra.nombre,
        estado: obra.estado,
        fecha_fin_real: obra.fecha_fin_real,
      },
      presupuesto: {
        id: presupuesto.id,
        nombre: presupuesto.nombre,
        moneda: presupuesto.moneda,
      },
      original_oficial: comparativo.original_oficial,
      trazabilidad_modificado: comparativo.trazabilidad_modificado,
      resumen: {
        original: comparativo.summary.original,
        modificado: comparativo.summary.modificado,
        valuado: comparativo.summary.valuado,
        valuado_reconsiderado: comparativo.summary.valuado_reconsiderado,
        reconsideracion_diferencial: comparativo.summary.reconsideracion_diferencial,
        economico_ajustado: economicoAjustado.toFixed(2),
        saldo_economico: diferenciaEconomica.toFixed(2),
        cantidad_modificada: comparativo.summary.cantidad_modificada,
        medido: comparativo.summary.medido,
        saldo_fisico: diferenciaFisica.toFixed(4),
        estado_cierre: estadoCierre,
        formalizacion: comparativo.summary.formalizacion,
      },
      detalle: comparativo.detalle,
    };
  }

  async generatePdf(
    type: string,
    tenantId: string,
    obraId: string,
    presupuestoId?: string,
    documentoId?: string,
  ) {
    const obra = await this.obraRepo.findOne({
      where: { id: obraId, tenant_id: tenantId },
    });
    if (!obra) throw new NotFoundException('Obra no encontrada');

    const presupuesto = presupuestoId
      ? await this.presupuestoRepo.findOne({
          where: { id: presupuestoId, tenant_id: tenantId },
        })
      : await this.presupuestoRepo.findOne({
          where: { obra_id: obraId, tenant_id: tenantId },
          order: { version: 'DESC' },
        });

    if (!presupuesto && type !== 'insumos') {
      throw new NotFoundException('Presupuesto no encontrado');
    }

    const doc = new PDFDocument({
      margin: type === 'presupuesto' ? 28 : 40,
      size: 'A4',
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const titleMap: Record<string, string> = {
      presupuesto: 'Reporte de Presupuesto',
      mediciones: 'Reporte de Mediciones',
      valuaciones: 'Reporte de Valuaciones',
      computos: 'Reporte de Computos Metricos',
      memorias: 'Reporte de Memorias Descriptivas',
      comparativo: 'Reporte Comparativo',
      modificado: 'Presupuesto Modificado',
      aumentos: 'Presupuesto de Aumentos',
      disminuciones: 'Presupuesto de Disminuciones',
      extras: 'Presupuesto de Obras Extras',
      'reconsideracion-precios': 'Reconsideracion de Precios',
      cierre: 'Cuadro de Cierre',
      insumos: 'Base de Insumos',
    };

    const reportTitle = titleMap[type];
    if (!reportTitle) {
      throw new BadRequestException('Tipo de reporte no soportado');
    }

    switch (type) {
      case 'presupuesto':
        await this.renderPresupuestoClassic(
          doc,
          obra,
          presupuesto!,
        );
        break;
      default:
        this.renderHeader(doc, reportTitle, obra.nombre, presupuesto?.nombre);
        break;
    }

    switch (type) {
      case 'mediciones':
        await this.renderMediciones(doc, tenantId, obraId);
        break;
      case 'valuaciones':
        await this.renderValuaciones(
          doc,
          tenantId,
          obraId,
          presupuesto!.moneda,
        );
        break;
      case 'computos':
        await this.renderComputos(
          doc,
          tenantId,
          obraId,
          presupuestoId,
          presupuesto!.moneda,
          documentoId,
        );
        break;
      case 'memorias':
        await this.renderMemorias(doc, tenantId, obraId, presupuestoId);
        break;
      case 'cierre':
        await this.renderCierre(
          doc,
          tenantId,
          obraId,
          presupuesto!.id,
          presupuesto!.moneda,
        );
        break;
      case 'comparativo':
      case 'modificado':
        await this.renderComparativo(
          doc,
          tenantId,
          obraId,
          presupuesto!.id,
          presupuesto!.moneda,
          type as 'comparativo' | 'modificado',
        );
        break;
      case 'aumentos':
      case 'disminuciones':
      case 'extras':
      case 'reconsideracion-precios':
        await this.renderReconsideracionDocumento(
          doc,
          tenantId,
          obraId,
          presupuestoId,
          presupuesto!.moneda,
          type,
          documentoId,
        );
        break;
      case 'insumos':
        await this.renderInsumos(doc, tenantId);
        break;
    }

    doc.end();
    const buffer = await done;
    return {
      buffer,
      filename: `${type}-${obra.codigo}.pdf`,
    };
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    title: string,
    obraNombre: string,
    presupuestoNombre?: string,
  ) {
    doc.fontSize(20).font('Helvetica-Bold').text(title);
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(`Obra: ${obraNombre}`);
    if (presupuestoNombre) {
      doc.text(`Presupuesto: ${presupuestoNombre}`);
    }
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`);
    doc.moveDown();
  }

  private renderSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
  }

  private line(doc: PDFKit.PDFDocument, value: string) {
    doc.text(value, { lineGap: 2 });
  }

  private formatCurrency(value: number | string, currency = 'USD') {
    const parsed =
      typeof value === 'number' ? value : Number.parseFloat(value || '0');
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(Number.isNaN(parsed) ? 0 : parsed);
  }

  private async renderPresupuesto(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    presupuestoId: string,
    currency: string,
  ) {
    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuestoId },
      order: { orden: 'ASC' },
    });

    for (const capitulo of capitulos) {
      this.renderSectionTitle(doc, `${capitulo.codigo} · ${capitulo.nombre}`);
      const partidas = await this.partidaRepo.find({
        where: { capitulo_id: capitulo.id },
        order: { orden: 'ASC' },
      });

      for (const partida of partidas) {
        this.line(
          doc,
          `${partida.codigo} | ${partida.descripcion} | ${partida.cantidad} ${partida.unidad} | PU ${this.formatCurrency(partida.precio_unitario, currency)} | Total ${this.formatCurrency(partida.importe_total, currency)}`,
        );
      }
      doc.moveDown(0.4);
    }
  }

  private async renderPresupuestoClassic(
    doc: PDFKit.PDFDocument,
    obra: BimObra,
    presupuesto: BimPresupuesto,
  ) {
    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuesto.id },
      order: { orden: 'ASC' },
    });
    const partidas = (
      await Promise.all(
        capitulos.map(async (capitulo) => {
          const rows = await this.partidaRepo.find({
            where: { capitulo_id: capitulo.id },
            order: { orden: 'ASC', id: 'ASC' },
          });
          return rows.map((partida) => ({ partida, capitulo }));
        }),
      )
    ).flat();

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const top = doc.y;

    doc.rect(left, top, pageWidth, 102).lineWidth(1).stroke('#111111');

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#111111')
      .text('NO SE HA PERSONALIZADO CORRECTAMENTE', left + 10, top + 6, {
        width: pageWidth - 20,
        align: 'left',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#111111')
      .text('PRESUPUESTO', left, top + 26, {
        width: pageWidth,
        align: 'center',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`Pág N°:  1`, left + pageWidth - 142, top + 30, {
        width: 132,
        align: 'right',
      })
      .text(`Fecha:  ${new Date().toLocaleDateString('es-ES')}`, left + pageWidth - 142, top + 50, {
        width: 132,
        align: 'right',
      });

    const contrato = obra.meta_json?.contrato_numero ?? presupuesto.descripcion ?? `ALC-${String(obra.id).padStart(4, '0')}`;
    const propietario = obra.cliente || 'CONSTRUCTORA';

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Obra:', left + 6, top + 54)
      .text('Contrato N°:', left + 6, top + 76)
      .text('Propietario:', left + 6, top + 98);

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(obra.nombre, left + 82, top + 54, { width: 300 })
      .text(contrato, left + 82, top + 76, { width: 300 })
      .text(propietario, left + 82, top + 98, { width: 300 });

    doc.y = top + 102;
    this.renderClassicBudgetTable(doc, partidas, presupuesto.moneda);

    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`TOTAL GENERAL ${presupuesto.moneda}: ${this.formatPlainNumber(presupuesto.total_presupuesto)}`, {
        align: 'right',
      });
  }

  private renderClassicBudgetTable(
    doc: PDFKit.PDFDocument,
    rows: Array<{ partida: BimPartida; capitulo: BimCapitulo }>,
    currency: string,
  ) {
    const left = doc.page.margins.left;
    const totalWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const widths = [34, 110, 180, 46, 60, 52, 57];
    const headers = [
      '',
      'PARTIDA',
      'DESCRIPCIÓN',
      'UNIDAD',
      'CANTIDAD',
      'P.U.',
      currency === 'VES' ? 'TOTAL Bs.' : `TOTAL ${currency}`,
    ];
    const tableTop = doc.y;

    let x = left;
    doc.rect(left, tableTop, totalWidth, 18).lineWidth(1).stroke('#111111');
    widths.forEach((width, index) => {
      if (index > 0) {
        doc.moveTo(x, tableTop).lineTo(x, tableTop + 18).stroke('#111111');
      }
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(headers[index], x + 4, tableTop + 5, {
          width: width - 8,
          align: index >= 4 ? 'center' : 'left',
        });
      x += width;
    });

    doc.y = tableTop + 18;

    rows.forEach(({ partida }, index) => {
      const descHeight = doc.heightOfString(partida.descripcion, {
        width: widths[2] - 10,
        align: 'left',
      });
      const codeHeight = doc.heightOfString(partida.codigo, {
        width: widths[1] - 10,
        align: 'left',
      });
      const rowHeight = Math.max(28, Math.max(descHeight, codeHeight) + 10);

      this.ensureClassicBudgetPage(doc, rowHeight + 30, widths, headers, currency);

      const topY = doc.y;
      let lineX = left;
      doc.rect(left, topY, totalWidth, rowHeight).lineWidth(0.5).stroke('#b7b7b7');
      widths.forEach((width, colIndex) => {
        if (colIndex > 0) {
          doc.moveTo(lineX, topY).lineTo(lineX, topY + rowHeight).stroke('#b7b7b7');
        }
        lineX += width;
      });

      const columns = [
        String(index + 1),
        partida.codigo,
        partida.descripcion,
        partida.unidad,
        this.formatPlainNumber(partida.cantidad),
        this.formatPlainNumber(partida.precio_unitario),
        this.formatPlainNumber(partida.importe_total),
      ];

      let cellX = left;
      columns.forEach((value, colIndex) => {
        doc
          .font(colIndex === 1 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .text(value, cellX + 4, topY + 4, {
            width: widths[colIndex] - 8,
            align: colIndex === 0 ? 'center' : colIndex >= 4 ? 'right' : 'left',
            lineGap: 1,
          });
        cellX += widths[colIndex];
      });

      doc.y = topY + rowHeight;
    });
  }

  private ensureClassicBudgetPage(
    doc: PDFKit.PDFDocument,
    requiredHeight: number,
    widths: number[],
    headers: string[],
    currency: string,
  ) {
    if (doc.y + requiredHeight <= doc.page.height - doc.page.margins.bottom) {
      return;
    }

    doc.addPage();
    const left = doc.page.margins.left;
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.y;
    let x = left;

    doc.rect(left, top, totalWidth, 18).lineWidth(1).stroke('#111111');
    widths.forEach((width, index) => {
      if (index > 0) {
        doc.moveTo(x, top).lineTo(x, top + 18).stroke('#111111');
      }
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(headers[index], x + 4, top + 5, {
          width: width - 8,
          align: index >= 4 ? 'center' : 'left',
        });
      x += width;
    });

    doc.y = top + 18;
  }

  private formatPlainNumber(value: number | string | null | undefined) {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isNaN(parsed) ? 0 : parsed);
  }

  private async renderMediciones(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
  ) {
    const documentos = await this.medicionDocumentoRepo.find({
      where: { tenant_id: tenantId, obra_id: obraId },
      order: { numero: 'ASC', created_at: 'ASC' },
    });

    this.renderSectionTitle(doc, 'Histórico de Mediciones');
    for (const documento of documentos) {
      this.line(
        doc,
        `Medición #${documento.numero} | ${new Date(documento.fecha).toLocaleDateString('es-ES')} | ${documento.titulo} | Estado ${documento.status}`,
      );

      const mediciones = await this.medicionRepo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
        relations: ['partida'],
        order: { id: 'ASC' },
      });

      for (const medicion of mediciones) {
        this.line(
          doc,
          `  ${medicion.partida?.codigo ?? ''} | ${medicion.partida?.descripcion ?? ''} | Ant ${medicion.cantidad_anterior} | Act ${medicion.cantidad_actual} | Acum ${medicion.cantidad_acumulada} | Avance ${medicion.porcentaje_avance}%`,
        );
      }

      doc.moveDown(0.3);
    }
  }

  private async renderComputos(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    presupuestoId: string | undefined,
    currency: string,
    documentoId?: string,
  ) {
    let targetDocumentoId = documentoId;

    if (!targetDocumentoId) {
      const documentos = await this.computosService.findByObra(
        obraId,
        tenantId,
        presupuestoId,
      );
      if (!documentos.length) {
        this.renderSectionTitle(doc, 'Computos metricos');
        this.line(doc, 'No hay documentos de computos para la obra seleccionada.');
        return;
      }
      targetDocumentoId = String(documentos[0].id);
    }

    const data = await this.computosService.getDocumentoResumen(
      targetDocumentoId,
      tenantId,
    );

    this.renderSectionTitle(
      doc,
      `Computos Nro. ${data.documento.numero} · ${data.documento.titulo}`,
    );
    this.line(
      doc,
      `Fecha: ${new Date(data.documento.fecha).toLocaleDateString('es-ES')} | Estado: ${data.documento.status}`,
    );
    if (data.documento.observaciones) {
      this.line(doc, `Observaciones: ${data.documento.observaciones}`);
    }
    this.line(
      doc,
      `Partidas: ${data.resumen.partidas} | Presupuesto base: ${this.formatPlainNumber(data.resumen.presupuesto_base)} | Computado: ${this.formatPlainNumber(data.resumen.computado_total)} | Monto: ${this.formatCurrency(data.resumen.monto_total, currency)}`,
    );
    doc.moveDown(0.4);

    for (const row of data.detalle) {
      this.line(
        doc,
        `${row.codigo} | ${row.descripcion_partida} | Formula ${row.formula_tipo} | Resultado ${this.formatPlainNumber(row.resultado)} ${row.unidad} | Total ${this.formatCurrency(row.total, currency)}`,
      );
      if (row.descripcion_computo && row.descripcion_computo !== row.descripcion_partida) {
        this.line(doc, `  Descripcion: ${row.descripcion_computo}`);
      }
      if (row.notas) {
        this.line(doc, `  Notas: ${row.notas}`);
      }
    }
  }

  private async renderValuaciones(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    currency: string,
  ) {
    const valuaciones = await this.certificacionRepo.find({
      where: { tenant_id: tenantId, obra_id: obraId },
      order: { numero: 'ASC' },
    });

    this.renderSectionTitle(doc, 'Valuaciones');
    for (const valuacion of valuaciones) {
      this.line(
        doc,
        `Valuación #${valuacion.numero} | ${new Date(valuacion.periodo_desde).toLocaleDateString('es-ES')} - ${new Date(valuacion.periodo_hasta).toLocaleDateString('es-ES')} | ${valuacion.estado} | Actual ${this.formatCurrency(valuacion.total_cert_actual, currency)} | Acum ${this.formatCurrency(valuacion.total_cert_acumulado, currency)}`,
      );

      const lineas = await this.lineaCertRepo.find({
        where: { certificacion_id: valuacion.id },
        relations: ['partida'],
        order: { id: 'ASC' },
      });

      for (const linea of lineas) {
        this.line(
          doc,
          `  ${linea.partida?.codigo ?? ''} | ${linea.partida?.descripcion ?? ''} | Act ${linea.cantidad_actual} | Acum ${linea.cantidad_acumulada} | Actual ${this.formatCurrency(linea.importe_actual, currency)} | Acum ${this.formatCurrency(linea.importe_acumulado, currency)}`,
        );
      }

      doc.moveDown(0.3);
    }
  }

  private async renderMemorias(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    presupuestoId?: string,
  ) {
    const memorias = await this.memoriasService.findByObra(
      obraId,
      tenantId,
      presupuestoId,
    );

    this.renderSectionTitle(doc, 'Memorias descriptivas');
    if (!memorias.length) {
      this.line(doc, 'No hay memorias descriptivas para la obra seleccionada.');
      return;
    }

    for (const memoria of memorias) {
      const partidaLabel = memoria.partida
        ? `${memoria.partida.codigo} · ${memoria.partida.descripcion}`
        : 'Sin partida especifica';
      this.line(
        doc,
        `${memoria.titulo} | Tipo ${memoria.tipo} | Estado ${memoria.status} | ${partidaLabel}`,
      );
      this.line(doc, memoria.contenido);
      doc.moveDown(0.4);
    }
  }

  private async renderReconsideracionDocumento(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    presupuestoId: string | undefined,
    currency: string,
    reportType: string,
    documentoId?: string,
  ) {
    const tipoMap: Record<string, string> = {
      aumentos: 'aumento',
      disminuciones: 'disminucion',
      extras: 'extra',
      'reconsideracion-precios': 'precio',
    };

    const targetTipo = tipoMap[reportType];
    let targetDocumentoId = documentoId;

    if (!targetTipo) {
      throw new BadRequestException('Tipo de reconsideracion no soportado');
    }

    if (!targetDocumentoId) {
      const documentos = await this.reconsideracionesService.findByObra(
        obraId,
        tenantId,
        targetTipo,
        presupuestoId,
      );
      if (!documentos.length) {
        this.renderSectionTitle(doc, 'Documentos del modulo');
        this.line(doc, 'No hay documentos disponibles para este reporte.');
        return;
      }
      targetDocumentoId = String(documentos[0].id);
    }

    const documento = await this.reconsideracionesService.findDocumento(
      targetDocumentoId,
      tenantId,
    );
    if (documento.tipo !== targetTipo) {
      throw new BadRequestException('El documento no corresponde al tipo de reporte solicitado');
    }

    const data = await this.reconsideracionesService.getDocumentoResumen(
      targetDocumentoId,
      tenantId,
    ) as any;

    this.renderSectionTitle(
      doc,
      `${documento.titulo} · Nro. ${documento.numero}`,
    );
    this.line(
      doc,
      `Fecha: ${new Date(documento.fecha).toLocaleDateString('es-ES')} | Estado: ${documento.status}`,
    );
    if (documento.certificacion) {
      this.line(
        doc,
        `Valuacion base: #${documento.certificacion.numero} | Estado ${documento.certificacion.estado}`,
      );
    }
    if (documento.observaciones) {
      this.line(doc, `Observaciones: ${documento.observaciones}`);
    }

    if (documento.tipo === 'precio') {
      this.line(doc, `Base: ${this.formatCurrency(data.resumen.base, currency)}`);
      this.line(doc, `Reconsiderado: ${this.formatCurrency(data.resumen.reconsiderado, currency)}`);
      this.line(doc, `Diferencial: ${this.formatCurrency(data.resumen.diferencial, currency)}`);
      this.line(doc, `Fuente: ${data.resumen.fuente}`);
      doc.moveDown(0.4);

      for (const row of data.detalle) {
        this.line(
          doc,
          `${row.codigo} | ${row.descripcion} | Base ${this.formatCurrency(row.monto_base, currency)} | Reconsiderado ${this.formatCurrency(row.monto_reconsiderado, currency)} | Diferencial ${this.formatCurrency(row.diferencial, currency)}`,
        );
        if (row.justificacion) {
          this.line(doc, `  Justificacion: ${row.justificacion}`);
        }
      }
      return;
    }

    if (documento.tipo === 'extra') {
      this.line(doc, `Original: ${this.formatCurrency(data.resumen.original, currency)}`);
      this.line(doc, `Extras: ${this.formatCurrency(data.resumen.extras, currency)}`);
      this.line(doc, `Aumentos: ${this.formatCurrency(data.resumen.aumentos, currency)}`);
      this.line(doc, `Disminuciones: ${this.formatCurrency(data.resumen.disminuciones, currency)}`);
      this.line(doc, `Modificado: ${this.formatCurrency(data.resumen.modificado, currency)}`);
      doc.moveDown(0.4);

      for (const row of data.detalle) {
        this.line(
          doc,
          `${row.codigo} | ${row.descripcion} | Cant ${this.formatPlainNumber(row.cantidad_extra)} ${row.unidad} | PU ${this.formatCurrency(row.precio_unitario, currency)} | Monto ${this.formatCurrency(row.monto_extra, currency)}`,
        );
        if (row.justificacion) {
          this.line(doc, `  Justificacion: ${row.justificacion}`);
        }
      }
      return;
    }

    this.line(doc, `Original: ${this.formatCurrency(data.resumen.original, currency)}`);
    this.line(doc, `Extras: ${this.formatCurrency(data.resumen.extras, currency)}`);
    this.line(doc, `Aumentos acumulados: ${this.formatCurrency(data.resumen.aumentos_acumulados, currency)}`);
    this.line(doc, `Disminuciones acumuladas: ${this.formatCurrency(data.resumen.disminuciones_acumuladas, currency)}`);
    this.line(doc, `Modificado: ${this.formatCurrency(data.resumen.modificado, currency)}`);
    doc.moveDown(0.4);

    for (const row of data.detalle) {
      this.line(
        doc,
        documento.tipo === 'aumento'
          ? `${row.codigo} | ${row.descripcion} | Orig ${this.formatPlainNumber(row.cantidad_original)} | Aum act ${this.formatPlainNumber(row.aumento_actual)} | Aum acum ${this.formatPlainNumber(row.cantidad_aumento_acumulado)} | Mod ${this.formatPlainNumber(row.cantidad_modificada)} | Monto act ${this.formatCurrency(row.monto_aumento_actual, currency)}`
          : `${row.codigo} | ${row.descripcion} | Orig ${this.formatPlainNumber(row.cantidad_original)} | Dism act ${this.formatPlainNumber(row.disminucion_actual)} | Dism acum ${this.formatPlainNumber(row.cantidad_disminucion_acumulada)} | Mod ${this.formatPlainNumber(row.cantidad_modificada)} | Monto act ${this.formatCurrency(row.monto_disminucion_actual, currency)}`,
      );
      if (row.justificacion) {
        this.line(doc, `  Justificacion: ${row.justificacion}`);
      }
    }
  }

  private async renderCierre(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    presupuestoId: string,
    currency: string,
  ) {
    const cierre = await this.getCierre(tenantId, obraId, presupuestoId);
    this.renderSectionTitle(doc, 'Cuadro de Cierre Consolidado');
    this.line(doc, `Modificado: ${this.formatCurrency(cierre.resumen.modificado, currency)}`);
    if (cierre.original_oficial) {
      this.line(
        doc,
        `Original oficial: ${cierre.original_oficial.nombre} (v${cierre.original_oficial.version})`,
      );
    }
    this.line(doc, `Reconsideracion precios: ${this.formatCurrency(cierre.resumen.reconsideracion_diferencial, currency)}`);
    this.line(doc, `Economico ajustado: ${this.formatCurrency(cierre.resumen.economico_ajustado, currency)}`);
    this.line(doc, `Valuado reconsiderado: ${this.formatCurrency(cierre.resumen.valuado_reconsiderado, currency)}`);
    this.line(doc, `Estado cierre: ${cierre.resumen.estado_cierre}`);
    if (cierre.trazabilidad_modificado.length) {
      this.line(
        doc,
        `Fuentes modificado: ${cierre.trazabilidad_modificado.map((item: any) => `${item.tipo} #${item.numero}`).join(', ')}`,
      );
    }
    doc.moveDown(0.4);
    for (const row of cierre.detalle) {
      this.line(
        doc,
        `${row.codigo} | ${row.descripcion} | Mod ${row.presupuesto_modificado} | Med ${row.medido} | Val ${row.valuado} | Val+Rec ${this.formatCurrency((row as any).monto_valuado_reconsiderado ?? row.monto_valuado, currency)}`,
      );
    }
  }

  private async renderInsumos(doc: PDFKit.PDFDocument, tenantId: string) {
    const recursos = await this.recursoRepo.find({
      where: { tenant_id: tenantId, activo: 1 },
      order: { tipo: 'ASC', descripcion: 'ASC' },
    });

    this.renderSectionTitle(doc, 'Base de Insumos');
    for (const recurso of recursos) {
      this.line(
        doc,
        `${recurso.codigo} | ${recurso.descripcion} | ${recurso.tipo} | ${recurso.unidad} | ${this.formatCurrency(recurso.precio)}`,
      );
    }
  }

  private async renderComparativo(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    presupuestoId: string,
    currency: string,
    type: 'comparativo' | 'modificado',
  ) {
    const data = await this.getComparativo(tenantId, obraId, presupuestoId);

    this.renderSectionTitle(
      doc,
      type === 'modificado' ? 'Resumen de presupuesto modificado' : 'Resumen comparativo',
    );
    this.line(doc, `Original: ${this.formatCurrency(data.summary.original, currency)}`);
    this.line(doc, `Modificado: ${this.formatCurrency(data.summary.modificado, currency)}`);
    if (data.original_oficial) {
      this.line(
        doc,
        `Original oficial: ${data.original_oficial.nombre} (v${data.original_oficial.version})`,
      );
    }
    this.line(doc, `Valuado: ${this.formatCurrency(data.summary.valuado, currency)}`);
    this.line(doc, `Reconsideracion precios: ${this.formatCurrency(data.summary.reconsideracion_diferencial, currency)}`);
    this.line(doc, `Valuado + reconsideracion: ${this.formatCurrency(data.summary.valuado_reconsiderado, currency)}`);
    this.line(doc, `Extras: ${data.summary.variaciones.extras}`);
    this.line(doc, `Aumentos: ${data.summary.variaciones.aumentos}`);
    this.line(doc, `Disminuciones: ${data.summary.variaciones.disminuciones}`);
    if (data.trazabilidad_modificado.length) {
      this.line(
        doc,
        `Fuentes modificado: ${data.trazabilidad_modificado.map((item: any) => `${item.tipo} #${item.numero}`).join(', ')}`,
      );
    }
    this.line(doc, `Pendientes borrador: Med ${data.summary.formalizacion.mediciones_borrador} | Val ${data.summary.formalizacion.valuaciones_borrador} | Rec ${data.summary.formalizacion.reconsideraciones_borrador}`);
    doc.moveDown(0.5);

    for (const row of data.detalle) {
      this.line(
        doc,
        `${row.codigo} | ${row.descripcion} | Ori ${row.presupuesto_original} | Mod ${row.presupuesto_modificado} | Comp ${row.computado} | Med ${row.medido} | Val ${row.valuado} | Rec ${row.reconsideracion_diferencial}`,
      );
    }
  }

  private async getFormalizacionResumen(
    tenantId: string,
    obraId: string,
    presupuestoId: string,
  ) {
    const [medicionesBorrador, valuacionesBorrador, reconsideracionesBorrador] =
      await Promise.all([
        this.medicionDocumentoRepo.count({
          where: {
            tenant_id: tenantId,
            obra_id: obraId,
            presupuesto_id: presupuestoId,
            status: 'borrador',
          },
        }),
        this.certificacionRepo.count({
          where: {
            tenant_id: tenantId,
            obra_id: obraId,
            presupuesto_id: presupuestoId,
            estado: 'borrador',
          },
        }),
        this.reconsideracionDocumentoRepo.count({
          where: {
            tenant_id: tenantId,
            obra_id: obraId,
            presupuesto_id: presupuestoId,
            status: 'borrador',
          },
        }),
      ]);

    return {
      mediciones_borrador: medicionesBorrador,
      valuaciones_borrador: valuacionesBorrador,
      reconsideraciones_borrador: reconsideracionesBorrador,
    };
  }

  private async buildCloseoutRows(
    tenantId: string,
    obraId: string,
    presupuestoId: string,
  ): Promise<CloseoutRow[]> {
    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuestoId },
      order: { orden: 'ASC' },
    });
    const capitulosById = new Map(capitulos.map((item) => [item.id, item]));

    const partidas = await this.partidaRepo.find({
      where: capitulos.map((capitulo) => ({ capitulo_id: capitulo.id })),
      order: { orden: 'ASC' },
    });

    const computos = await this.computoRepo.find({
      where: { tenant_id: tenantId, obra_id: obraId },
    });
    const mediciones = await this.medicionRepo.find({
      where: { tenant_id: tenantId, obra_id: obraId },
      order: { fecha_medicion: 'ASC', created_at: 'ASC' },
    });
    const valuaciones = await this.certificacionRepo.find({
      where: { tenant_id: tenantId, obra_id: obraId },
    });
    const lineas = valuaciones.length
      ? await this.lineaCertRepo.find({
          where: valuaciones.map((item) => ({ certificacion_id: item.id })),
        })
      : [];

    const computosByPartida = new Map<string, number>();
    const medicionesByPartida = new Map<string, number>();
    const valuadoByPartida = new Map<string, number>();

    for (const computo of computos) {
      computosByPartida.set(
        computo.partida_id,
        (computosByPartida.get(computo.partida_id) ?? 0) +
          Number.parseFloat(computo.resultado ?? '0'),
      );
    }

    for (const medicion of mediciones) {
      const current = medicionesByPartida.get(medicion.partida_id) ?? 0;
      medicionesByPartida.set(
        medicion.partida_id,
        Math.max(
          current,
          Number.parseFloat(medicion.cantidad_acumulada ?? '0'),
        ),
      );
    }

    for (const linea of lineas) {
      valuadoByPartida.set(
        linea.partida_id,
        (valuadoByPartida.get(linea.partida_id) ?? 0) +
          Number.parseFloat(linea.importe_actual ?? '0'),
      );
    }

    return partidas.map((partida) => {
      const capitulo = capitulosById.get(partida.capitulo_id);
      return {
        capitulo:
          `${capitulo?.codigo ?? ''} · ${capitulo?.nombre ?? ''}`.trim(),
        partida: `${partida.codigo} · ${partida.descripcion}`,
        unidad: partida.unidad,
        presupuestoCantidad: Number.parseFloat(partida.cantidad ?? '0'),
        computado: computosByPartida.get(partida.id) ?? 0,
        medido: medicionesByPartida.get(partida.id) ?? 0,
        montoPresupuesto: Number.parseFloat(partida.importe_total ?? '0'),
        montoValuado: valuadoByPartida.get(partida.id) ?? 0,
      };
    });
  }

  private sumBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
    return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  }
}
