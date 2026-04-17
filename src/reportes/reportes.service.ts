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

    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuesto.id },
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
    const mediciones = await this.medicionRepo.find({ where: { obra_id: obraId, tenant_id: tenantId } });
    const valuaciones = await this.lineaCertRepo
      .createQueryBuilder('linea')
      .innerJoin(BimCertificacion, 'cert', 'cert.id = linea.certificacion_id')
      .where('cert.tenant_id = :tenantId', { tenantId })
      .andWhere('cert.obra_id = :obraId', { obraId })
      .getMany();
    const reconsideraciones = await this.reconsideracionRepo
      .createQueryBuilder('rec')
      .innerJoin(BimReconsideracionDocumento, 'doc', 'doc.id = rec.documento_id')
      .where('doc.tenant_id = :tenantId', { tenantId })
      .andWhere('doc.obra_id = :obraId', { obraId })
      .getMany();

    const computosMap = new Map<string, number>();
    const medicionesMap = new Map<string, number>();
    const valuacionesMap = new Map<string, number>();
    const extrasMap = new Map<string, number>();
    const aumentosMap = new Map<string, number>();
    const disminucionesMap = new Map<string, number>();

    for (const item of computos) {
      computosMap.set(String(item.partida_id), Number(item.resultado ?? 0));
    }
    for (const item of mediciones) {
      medicionesMap.set(String(item.partida_id), Number(item.cantidad_acumulada ?? 0));
    }
    for (const item of valuaciones) {
      valuacionesMap.set(String(item.partida_id), Number(item.cantidad_acumulada ?? 0));
    }
    for (const item of reconsideraciones) {
      const partidaId = String(item.partida_id);
      const cantidad = Math.abs(Number(item.cantidad_variacion ?? 0));
      if (item.tipo === 'extra') extrasMap.set(partidaId, cantidad);
      if (item.tipo === 'aumento') aumentosMap.set(partidaId, (aumentosMap.get(partidaId) ?? 0) + cantidad);
      if (item.tipo === 'disminucion') disminucionesMap.set(partidaId, (disminucionesMap.get(partidaId) ?? 0) + cantidad);
    }

    const detalle = partidas.map(({ partida, capitulo }, index) => {
      const baseCantidad = Number(partida.cantidad ?? 0);
      const extras = extrasMap.get(String(partida.id)) ?? (partida.es_extra ? baseCantidad : 0);
      const aumentos = aumentosMap.get(String(partida.id)) ?? 0;
      const disminuciones = disminucionesMap.get(String(partida.id)) ?? 0;
      const modificada = baseCantidad + extras + aumentos - disminuciones;
      const computado = computosMap.get(String(partida.id)) ?? 0;
      const medido = medicionesMap.get(String(partida.id)) ?? 0;
      const valuado = valuacionesMap.get(String(partida.id)) ?? 0;
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
        monto_original: (baseCantidad * precioUnitario).toFixed(2),
        monto_modificado: (modificada * precioUnitario).toFixed(2),
        monto_valuado: (valuado * precioUnitario).toFixed(2),
      };
    });

    return {
      obra,
      presupuesto,
      summary: {
        original: this.sumBy(detalle, 'monto_original').toFixed(2),
        modificado: this.sumBy(detalle, 'monto_modificado').toFixed(2),
        valuado: this.sumBy(detalle, 'monto_valuado').toFixed(2),
        computado: this.sumBy(detalle, 'computado').toFixed(4),
        medido: this.sumBy(detalle, 'medido').toFixed(4),
        cantidad_modificada: this.sumBy(detalle, 'presupuesto_modificado').toFixed(4),
        variaciones: {
          extras: this.sumBy(detalle, 'extras').toFixed(4),
          aumentos: this.sumBy(detalle, 'aumentos').toFixed(4),
          disminuciones: this.sumBy(detalle, 'disminuciones').toFixed(4),
        },
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

    const original = Number(comparativo.summary.original ?? 0);
    const modificado = Number(comparativo.summary.modificado ?? 0);
    const valuado = Number(comparativo.summary.valuado ?? 0);
    const diferenciaEconomica = modificado - valuado;

    const cantidadModificada = Number(comparativo.summary.cantidad_modificada ?? 0);
    const medido = Number(comparativo.summary.medido ?? 0);
    const diferenciaFisica = cantidadModificada - medido;

    const estadoCierre =
      Math.abs(diferenciaEconomica) < 0.01 && Math.abs(diferenciaFisica) < 0.0001
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
      resumen: {
        original: comparativo.summary.original,
        modificado: comparativo.summary.modificado,
        valuado: comparativo.summary.valuado,
        saldo_economico: diferenciaEconomica.toFixed(2),
        cantidad_modificada: comparativo.summary.cantidad_modificada,
        medido: comparativo.summary.medido,
        saldo_fisico: diferenciaFisica.toFixed(4),
        estado_cierre: estadoCierre,
      },
      detalle: comparativo.detalle,
    };
  }

  async generatePdf(
    type: string,
    tenantId: string,
    obraId: string,
    presupuestoId?: string,
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
      comparativo: 'Reporte Comparativo',
      modificado: 'Presupuesto Modificado',
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

  private async renderCierre(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    obraId: string,
    presupuestoId: string,
    currency: string,
  ) {
    const rows = await this.buildCloseoutRows(tenantId, obraId, presupuestoId);
    this.renderSectionTitle(doc, 'Cuadro de Cierre Consolidado');
    for (const row of rows) {
      this.line(
        doc,
        `${row.capitulo} | ${row.partida} | Pres ${row.presupuestoCantidad.toFixed(2)} | Comp ${row.computado.toFixed(2)} | Med ${row.medido.toFixed(2)} | Presup ${this.formatCurrency(row.montoPresupuesto, currency)} | Val ${this.formatCurrency(row.montoValuado, currency)}`,
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
    this.line(doc, `Valuado: ${this.formatCurrency(data.summary.valuado, currency)}`);
    this.line(doc, `Extras: ${data.summary.variaciones.extras}`);
    this.line(doc, `Aumentos: ${data.summary.variaciones.aumentos}`);
    this.line(doc, `Disminuciones: ${data.summary.variaciones.disminuciones}`);
    doc.moveDown(0.5);

    for (const row of data.detalle) {
      this.line(
        doc,
        `${row.codigo} | ${row.descripcion} | Ori ${row.presupuesto_original} | Mod ${row.presupuesto_modificado} | Comp ${row.computado} | Med ${row.medido} | Val ${row.valuado}`,
      );
    }
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
