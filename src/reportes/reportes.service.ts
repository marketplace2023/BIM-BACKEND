import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument = require('pdfkit');
import { Repository } from 'typeorm';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimComputo } from '../database/entities/bim/bim-computo.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
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
    @InjectRepository(BimCertificacion)
    private readonly certificacionRepo: Repository<BimCertificacion>,
    @InjectRepository(BimLineaCertificacion)
    private readonly lineaCertRepo: Repository<BimLineaCertificacion>,
    @InjectRepository(BimRecurso)
    private readonly recursoRepo: Repository<BimRecurso>,
  ) {}

  async generatePdf(
    type: string,
    tenantId: string,
    obraId: string,
    presupuestoId?: string,
  ) {
    const obra = await this.obraRepo.findOne({ where: { id: obraId, tenant_id: tenantId } });
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

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const titleMap: Record<string, string> = {
      presupuesto: 'Reporte de Presupuesto',
      mediciones: 'Reporte de Mediciones',
      valuaciones: 'Reporte de Valuaciones',
      cierre: 'Cuadro de Cierre',
      insumos: 'Base de Insumos',
    };

    const reportTitle = titleMap[type];
    if (!reportTitle) {
      throw new BadRequestException('Tipo de reporte no soportado');
    }

    this.renderHeader(doc, reportTitle, obra.nombre, presupuesto?.nombre);

    switch (type) {
      case 'presupuesto':
        await this.renderPresupuesto(doc, tenantId, presupuesto!.id, presupuesto!.moneda);
        break;
      case 'mediciones':
        await this.renderMediciones(doc, tenantId, obraId);
        break;
      case 'valuaciones':
        await this.renderValuaciones(doc, tenantId, obraId, presupuesto!.moneda);
        break;
      case 'cierre':
        await this.renderCierre(doc, tenantId, obraId, presupuesto!.id, presupuesto!.moneda);
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
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value || '0');
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

  private async renderMediciones(doc: PDFKit.PDFDocument, tenantId: string, obraId: string) {
    const mediciones = await this.medicionRepo.find({
      where: { tenant_id: tenantId, obra_id: obraId },
      relations: ['partida'],
      order: { fecha_medicion: 'ASC', created_at: 'ASC' },
    });

    this.renderSectionTitle(doc, 'Histórico de Mediciones');
    for (const medicion of mediciones) {
      this.line(
        doc,
        `${new Date(medicion.fecha_medicion).toLocaleDateString('es-ES')} | ${medicion.partida?.codigo ?? ''} ${medicion.partida?.descripcion ?? ''} | Ant ${medicion.cantidad_anterior} | Act ${medicion.cantidad_actual} | Acum ${medicion.cantidad_acumulada} | Avance ${medicion.porcentaje_avance}%`,
      );
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
        (computosByPartida.get(computo.partida_id) ?? 0) + Number.parseFloat(computo.resultado ?? '0'),
      );
    }

    for (const medicion of mediciones) {
      const current = medicionesByPartida.get(medicion.partida_id) ?? 0;
      medicionesByPartida.set(
        medicion.partida_id,
        Math.max(current, Number.parseFloat(medicion.cantidad_acumulada ?? '0')),
      );
    }

    for (const linea of lineas) {
      valuadoByPartida.set(
        linea.partida_id,
        (valuadoByPartida.get(linea.partida_id) ?? 0) + Number.parseFloat(linea.importe_actual ?? '0'),
      );
    }

    return partidas.map((partida) => {
      const capitulo = capitulosById.get(partida.capitulo_id);
      return {
        capitulo: `${capitulo?.codigo ?? ''} · ${capitulo?.nombre ?? ''}`.trim(),
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
}
