import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument = require('pdfkit');
import { Repository, DataSource } from 'typeorm';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPartidaMaterial } from '../database/entities/bim/bim-partida-material.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimApuDescomposicion } from '../database/entities/bim/bim-apu-descomposicion.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimPrecioUnitario } from '../database/entities/bim/bim-precio-unitario.entity';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import { BimPresupuestoModificadoFuente } from '../database/entities/bim/bim-presupuesto-modificado-fuente.entity';
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

type ProjectAwareUnitPriceBreakdown = {
  costo_directo: number;
  costo_materiales: number;
  costo_equipos: number;
  costo_mano_obra: number;
  costo_otros: number;
  base_labor: number;
  labor_factor: number;
  gastos_medicos: number;
  subtotal_directo_ajustado: number;
  administracion_pct: number;
  utilidad_pct: number;
  financiamiento_pct: number;
  iva_pct: number;
  iva_modo: string;
  base_iva: number;
  financiamiento_incluye_utilidad: boolean;
  total_sin_iva: number;
  iva_monto: number;
  total_final: number;
};

type PartidaDirectCostBreakdown = {
  total: number;
  materiales: number;
  equipos: number;
  mano_obra: number;
  otros: number;
};

type PresupuestoModificadoDetalle = {
  partida_base_id: string;
  capitulo_base_id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  orden: number;
  capitulo_codigo: string;
  capitulo_nombre: string;
  capitulo_orden: number;
  cantidad_original: number;
  precio_unitario: number;
  cantidad_aumento: number;
  cantidad_disminucion: number;
  cantidad_extra: number;
  cantidad_modificada: number;
  monto_original: number;
  monto_modificado: number;
  es_extra: boolean;
};

type PresupuestoModificadoSnapshot = {
  presupuesto_base: BimPresupuesto;
  presupuesto_modificado: BimPresupuesto | null;
  original_oficial: BimPresupuesto | null;
  fuentes: Array<{
    documento_id: string;
    tipo: string;
    numero: number;
    fecha: string;
    titulo: string;
    status: string;
  }>;
  resumen: {
    original: string;
    extras: string;
    aumentos: string;
    disminuciones: string;
    modificado: string;
  };
  detalle: Array<{
    partida_base_id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    capitulo_codigo: string;
    capitulo_nombre: string;
    cantidad_original: string;
    precio_unitario: string;
    cantidad_extra: string;
    cantidad_aumento: string;
    cantidad_disminucion: string;
    cantidad_modificada: string;
    monto_original: string;
    monto_modificado: string;
    es_extra: number;
  }>;
};

type PresupuestoTreeCapitulo = BimCapitulo & {
  partidas: BimPartida[];
  children: PresupuestoTreeCapitulo[];
};

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
    @InjectRepository(BimPresupuestoModificadoFuente)
    private readonly presupuestoModificadoFuenteRepo: Repository<BimPresupuestoModificadoFuente>,
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
        es_oficial: false,
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
          ...pDto,
          capitulo_id: savedCap.id,
        });
        await manager.save(BimPartida, partida);
      }
    }
  }

  async findByObra(
    obraId: string,
    tenantId: string,
    tipo?: string,
  ): Promise<BimPresupuesto[]> {
    await this.findTenantObra(obraId, tenantId);
    const where: { obra_id: string; tenant_id: string; tipo?: string } = {
      obra_id: obraId,
      tenant_id: tenantId,
    };
    if (tipo) {
      where.tipo = tipo;
    }
    return this.presupuestoRepo.find({
      where,
      order: { es_oficial: 'DESC', version: 'DESC', created_at: 'DESC' },
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
      order: { orden: 'ASC', id: 'ASC' },
    });

    const partidasPorCapitulo = new Map<string, BimPartida[]>();
    for (const cap of capitulos) {
      const partidas = await this.partidaRepo.find({
        where: { capitulo_id: cap.id },
        order: { orden: 'ASC', id: 'ASC' },
      });
      partidasPorCapitulo.set(cap.id, partidas);
    }

    const capitulosByParent = new Map<string | null, BimCapitulo[]>();
    for (const capitulo of capitulos) {
      const key = capitulo.parent_id ? String(capitulo.parent_id) : null;
      const rows = capitulosByParent.get(key) ?? [];
      rows.push(capitulo);
      capitulosByParent.set(key, rows);
    }

    const buildTree = (parentId: string | null): PresupuestoTreeCapitulo[] => {
      const nodes = capitulosByParent.get(parentId) ?? [];
      return nodes.map((capitulo) => ({
        ...capitulo,
        partidas: partidasPorCapitulo.get(capitulo.id) ?? [],
        children: buildTree(String(capitulo.id)),
      }));
    };

    return {
      ...presupuesto,
      capitulos: buildTree(null),
    };
  }

  async getPresupuestoModificado(
    presupuestoId: string,
    tenantId: string,
  ): Promise<PresupuestoModificadoSnapshot> {
    const presupuestoBase = await this.resolvePresupuestoBase(
      presupuestoId,
      tenantId,
    );
    const detalle = await this.buildPresupuestoModificadoDetalle(
      presupuestoBase,
      tenantId,
    );
    const originalOficial = await this.findPresupuestoOriginalOficial(
      presupuestoBase.obra_id,
      tenantId,
    );
    const presupuestoModificado = await this.presupuestoRepo.findOne({
      where: {
        tenant_id: tenantId,
        presupuesto_base_id: presupuestoBase.id,
        tipo: 'modificado',
      },
      order: { es_oficial: 'DESC', version: 'DESC', updated_at: 'DESC' },
    });
    const fuentes = presupuestoModificado
      ? await this.listPresupuestoModificadoFuentes(presupuestoModificado.id, tenantId)
      : [];

    const original = detalle.reduce((sum, item) => sum + item.monto_original, 0);
    const extras = detalle.reduce((sum, item) => sum + item.cantidad_extra * item.precio_unitario, 0);
    const aumentos = detalle.reduce((sum, item) => sum + item.cantidad_aumento * item.precio_unitario, 0);
    const disminuciones = detalle.reduce((sum, item) => sum + item.cantidad_disminucion * item.precio_unitario, 0);
    const modificado = detalle.reduce((sum, item) => sum + item.monto_modificado, 0);

    return {
      presupuesto_base: presupuestoBase,
      presupuesto_modificado: presupuestoModificado,
      original_oficial: originalOficial,
      fuentes,
      resumen: {
        original: original.toFixed(2),
        extras: extras.toFixed(2),
        aumentos: aumentos.toFixed(2),
        disminuciones: disminuciones.toFixed(2),
        modificado: modificado.toFixed(2),
      },
      detalle: detalle.map((item) => ({
        partida_base_id: item.partida_base_id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad: item.unidad,
        capitulo_codigo: item.capitulo_codigo,
        capitulo_nombre: item.capitulo_nombre,
        cantidad_original: item.cantidad_original.toFixed(4),
        precio_unitario: item.precio_unitario.toFixed(4),
        cantidad_extra: item.cantidad_extra.toFixed(4),
        cantidad_aumento: item.cantidad_aumento.toFixed(4),
        cantidad_disminucion: item.cantidad_disminucion.toFixed(4),
        cantidad_modificada: item.cantidad_modificada.toFixed(4),
        monto_original: item.monto_original.toFixed(2),
        monto_modificado: item.monto_modificado.toFixed(2),
        es_extra: item.es_extra ? 1 : 0,
      })),
    };
  }

  async syncPresupuestoModificado(
    presupuestoId: string,
    userId: string,
    tenantId: string,
  ): Promise<PresupuestoModificadoSnapshot> {
    const presupuestoBase = await this.resolvePresupuestoBase(
      presupuestoId,
      tenantId,
    );
    const detalle = await this.buildPresupuestoModificadoDetalle(
      presupuestoBase,
      tenantId,
    );

    return this.dataSource.transaction(async (manager) => {
      const presupuestoRepo = manager.getRepository(BimPresupuesto);
      const capituloRepo = manager.getRepository(BimCapitulo);
      const partidaRepo = manager.getRepository(BimPartida);

      let presupuestoModificado = await presupuestoRepo.findOne({
        where: {
          tenant_id: tenantId,
          presupuesto_base_id: presupuestoBase.id,
          tipo: 'modificado',
        },
        order: { es_oficial: 'DESC', version: 'DESC', updated_at: 'DESC' },
      });

      const totalModificado = detalle.reduce(
        (sum, item) => sum + item.monto_modificado,
        0,
      );

      if (!presupuestoModificado) {
        presupuestoModificado = presupuestoRepo.create({
          tenant_id: tenantId,
          obra_id: presupuestoBase.obra_id,
          presupuesto_base_id: presupuestoBase.id,
          tipo: 'modificado',
          es_oficial: true,
          nombre: `Presupuesto modificado · ${presupuestoBase.nombre}`,
          descripcion: `Snapshot formal derivado del presupuesto base #${presupuestoBase.id}`,
          moneda: presupuestoBase.moneda,
          gastos_indirectos_pct: presupuestoBase.gastos_indirectos_pct,
          beneficio_pct: presupuestoBase.beneficio_pct,
          iva_pct: presupuestoBase.iva_pct,
          estado: 'revisado',
          total_presupuesto: totalModificado.toFixed(2),
          created_by: userId,
          aprobado_por: null,
          fecha_aprobacion: null,
        });
      } else {
        presupuestoModificado.es_oficial = true;
        presupuestoModificado.nombre = `Presupuesto modificado · ${presupuestoBase.nombre}`;
        presupuestoModificado.descripcion = `Snapshot formal derivado del presupuesto base #${presupuestoBase.id}`;
        presupuestoModificado.moneda = presupuestoBase.moneda;
        presupuestoModificado.gastos_indirectos_pct = presupuestoBase.gastos_indirectos_pct;
        presupuestoModificado.beneficio_pct = presupuestoBase.beneficio_pct;
        presupuestoModificado.iva_pct = presupuestoBase.iva_pct;
        presupuestoModificado.estado = 'revisado';
        presupuestoModificado.total_presupuesto = totalModificado.toFixed(2);
        presupuestoModificado.aprobado_por = null;
        presupuestoModificado.fecha_aprobacion = null;
      }

      presupuestoModificado = await presupuestoRepo.save(presupuestoModificado);
      await presupuestoRepo
        .createQueryBuilder()
        .update(BimPresupuesto)
        .set({ es_oficial: false })
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('tipo = :tipo', { tipo: 'modificado' })
        .andWhere('presupuesto_base_id = :presupuestoBaseId', {
          presupuestoBaseId: presupuestoBase.id,
        })
        .andWhere('id <> :id', { id: presupuestoModificado.id })
        .execute();

      const documentosFuente = await this.findDocumentosFuenteModificado(
        presupuestoBase.id,
        tenantId,
      );
      const fuenteRepo = manager.getRepository(BimPresupuestoModificadoFuente);
      await fuenteRepo.delete({
        tenant_id: tenantId,
        presupuesto_id: presupuestoModificado.id,
      });
      if (documentosFuente.length) {
        await fuenteRepo.save(
          documentosFuente.map((documento) =>
            fuenteRepo.create({
              tenant_id: tenantId,
              presupuesto_id: presupuestoModificado.id,
              documento_id: documento.id,
              tipo_documento: documento.tipo,
            }),
          ),
        );
      }

      const capitulosExistentes = await capituloRepo.find({
        where: { presupuesto_id: presupuestoModificado.id },
        order: { orden: 'ASC', id: 'ASC' },
      });
      const capitulosByCodigo = new Map(
        capitulosExistentes.map((capitulo) => [capitulo.codigo, capitulo]),
      );
      const capitulosActivos = new Set<string>();

      const detalleAgrupado = new Map<string, PresupuestoModificadoDetalle[]>();
      for (const item of detalle) {
        const key = `${item.capitulo_codigo}::${item.capitulo_nombre}`;
        const rows = detalleAgrupado.get(key) ?? [];
        rows.push(item);
        detalleAgrupado.set(key, rows);
      }

      for (const [key, rows] of detalleAgrupado.entries()) {
        const first = rows[0];
        let capitulo = capitulosByCodigo.get(first.capitulo_codigo) ?? null;

        if (!capitulo) {
          capitulo = capituloRepo.create({
            presupuesto_id: presupuestoModificado.id,
            codigo: first.capitulo_codigo,
            nombre: first.capitulo_nombre,
            orden: first.capitulo_orden,
            parent_id: null,
          });
        } else {
          capitulo.nombre = first.capitulo_nombre;
          capitulo.orden = first.capitulo_orden;
        }

        capitulo = await capituloRepo.save(capitulo);
        capitulosActivos.add(capitulo.id);

        const partidasExistentes = await partidaRepo.find({
          where: { capitulo_id: capitulo.id },
          order: { orden: 'ASC', id: 'ASC' },
        });
        const partidasByCodigo = new Map(
          partidasExistentes.map((partida) => [partida.codigo, partida]),
        );
        const partidasActivas = new Set<string>();

        for (const row of rows.sort((a, b) => a.orden - b.orden)) {
          let partida = partidasByCodigo.get(row.codigo) ?? null;

          if (!partida) {
            partida = partidaRepo.create({
              capitulo_id: capitulo.id,
              codigo: row.codigo,
              descripcion: row.descripcion,
              unidad: row.unidad,
              cantidad: row.cantidad_modificada.toFixed(4),
              precio_unitario: row.precio_unitario.toFixed(4),
              observaciones: row.es_extra
                ? `Partida extra originada desde presupuesto base #${presupuestoBase.id}`
                : null,
              es_extra: row.es_extra ? 1 : 0,
              orden: row.orden,
            });
          } else {
            partida.descripcion = row.descripcion;
            partida.unidad = row.unidad;
            partida.cantidad = row.cantidad_modificada.toFixed(4);
            partida.precio_unitario = row.precio_unitario.toFixed(4);
            partida.es_extra = row.es_extra ? 1 : 0;
            partida.orden = row.orden;
            partida.observaciones = row.es_extra
              ? `Partida extra originada desde presupuesto base #${presupuestoBase.id}`
              : null;
          }

          partida = await partidaRepo.save(partida);
          partidasActivas.add(partida.id);
        }

        const partidasAEliminar = partidasExistentes.filter(
          (partida) => !partidasActivas.has(partida.id),
        );
        if (partidasAEliminar.length) {
          await partidaRepo.remove(partidasAEliminar);
        }
      }

      const capitulosAEliminar = capitulosExistentes.filter(
        (capitulo) => !capitulosActivos.has(capitulo.id),
      );
      if (capitulosAEliminar.length) {
        await capituloRepo.remove(capitulosAEliminar);
      }

      await this.recalcularTotal(presupuestoModificado.id, tenantId, manager);

      return this.getPresupuestoModificado(presupuestoBase.id, tenantId);
    });
  }

  async generatePdf(id: string, tenantId: string) {
    const presupuesto = await this.findOne(id, tenantId);
    const tree = await this.findWithTree(id, tenantId);
    const flatCapitulos = this.flattenCapituloTree(tree.capitulos);

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    this.renderPdfHeader(doc, presupuesto, flatCapitulos.length);
    this.renderPdfSummary(
      doc,
      presupuesto,
      flatCapitulos.reduce((sum, cap) => sum + (cap.partidas?.length ?? 0), 0),
    );

    for (const capitulo of flatCapitulos) {
      this.renderPdfCapitulo(doc, capitulo, presupuesto.moneda);
    }

    doc
      .moveDown(0.8)
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#111827')
      .text(`TOTAL PRESUPUESTO: ${this.formatCurrency(presupuesto.total_presupuesto, presupuesto.moneda)}`, {
        align: 'right',
      });

    doc.end();
    const buffer = await done;

    return {
      buffer,
      filename: `presupuesto-${presupuesto.obra?.codigo ?? presupuesto.id}.pdf`,
    };
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePresupuestoDto,
  ): Promise<BimPresupuesto> {
    const p = await this.findOne(id, tenantId);
    await this.assertPresupuestoEditable(p.id, tenantId);
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
    let p = await this.findOne(id, tenantId);
    if (p.tipo === 'modificado') {
      await this.syncPresupuestoModificado(id, userId, tenantId);
      p = await this.findOne(id, tenantId);
    }
    if (
      p.estado !== 'borrador' &&
      p.estado !== 'revisado' &&
      p.estado !== 'aprobado'
    ) {
      throw new BadRequestException(
        'Solo se pueden oficializar presupuestos en borrador, revisado o aprobado',
      );
    }
    p.estado = 'aprobado';
    p.aprobado_por = userId;
    p.fecha_aprobacion = new Date();
    p.es_oficial = true;
    const saved = await this.presupuestoRepo.save(p);

    if (saved.tipo === 'obra' || saved.tipo === 'sin_apu') {
      await this.presupuestoRepo
        .createQueryBuilder()
        .update(BimPresupuesto)
        .set({ es_oficial: false })
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('obra_id = :obraId', { obraId: saved.obra_id })
        .andWhere('tipo IN (:...tipos)', { tipos: ['obra', 'sin_apu'] })
        .andWhere('id <> :id', { id: saved.id })
        .execute();
    }

    if (saved.tipo === 'modificado' && saved.presupuesto_base_id) {
      await this.presupuestoRepo
        .createQueryBuilder()
        .update(BimPresupuesto)
        .set({ es_oficial: false })
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('tipo = :tipo', { tipo: 'modificado' })
        .andWhere('presupuesto_base_id = :presupuestoBaseId', {
          presupuestoBaseId: saved.presupuesto_base_id,
        })
        .andWhere('id <> :id', { id: saved.id })
        .execute();
    }

    return this.findOne(saved.id, tenantId);
  }

  async getFormalizacionContexto(obraId: string, tenantId: string) {
    await this.findTenantObra(obraId, tenantId);
    const originalOficial = await this.findPresupuestoOriginalOficial(
      obraId,
      tenantId,
    );

    if (!originalOficial) {
      return {
        original_oficial: null,
        modificado_vigente: null,
        fuentes_modificado: [],
      };
    }

    const modificadoVigente = await this.presupuestoRepo.findOne({
      where: {
        tenant_id: tenantId,
        presupuesto_base_id: originalOficial.id,
        tipo: 'modificado',
        es_oficial: true,
      },
      order: { version: 'DESC', updated_at: 'DESC' },
    });

    return {
      original_oficial: originalOficial,
      modificado_vigente: modificadoVigente,
      fuentes_modificado: modificadoVigente
        ? await this.listPresupuestoModificadoFuentes(modificadoVigente.id, tenantId)
        : [],
    };
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
    p.es_oficial = false;
    p.aprobado_por = null;
    p.fecha_aprobacion = null;
    return this.presupuestoRepo.save(p);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const p = await this.findOne(id, tenantId);
    await this.assertPresupuestoEditable(p.id, tenantId);
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
    await this.assertPresupuestoEditable(presupuestoId, tenantId);
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
    await this.assertPresupuestoEditable(cap.presupuesto_id, tenantId);
    Object.assign(cap, dto);
    return this.capituloRepo.save(cap);
  }

  async removeCapitulo(id: string, tenantId: string): Promise<void> {
    const cap = await this.findCapitulo(id, tenantId);
    if (!cap) throw new NotFoundException(`Capítulo #${id} no encontrado`);
    await this.assertPresupuestoEditable(cap.presupuesto_id, tenantId);
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
    await this.assertPresupuestoEditable(cap.presupuesto_id, tenantId);
    return this.dataSource.transaction(async (manager) => {
      const partida = manager.create(BimPartida, {
        ...dto,
        capitulo_id: capituloId,
      });
      const savedPartida = await manager.save(BimPartida, partida);

      if (savedPartida.precio_unitario_id) {
        await this.seedPartidaMaterialesFromApu(manager, savedPartida, tenantId);
        await this.recalcularPrecioUnitarioPartida(
          savedPartida.id,
          tenantId,
          manager,
        );
      }

      await this.recalcularTotalByCapitulo(capituloId, tenantId, manager);

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
      if (!partida.es_extra) {
        const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId, manager);
        await this.assertPresupuestoEditable(capitulo.presupuesto_id, tenantId);
      } else {
        await this.assertPartidaEditable(partida.id, tenantId);
      }
      Object.assign(partida, dto);
      const saved = await manager.save(BimPartida, partida);
      await this.recalcularTotalByCapitulo(saved.capitulo_id, tenantId, manager);
      return saved;
    });
  }

  async removePartida(id: string, tenantId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const partida = await this.findPartida(id, tenantId, manager);
      if (!partida) {
        throw new NotFoundException(`Partida #${id} no encontrada`);
      }
      if (!partida.es_extra) {
        const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId, manager);
        await this.assertPresupuestoEditable(capitulo.presupuesto_id, tenantId);
      } else {
        await this.assertPartidaEditable(partida.id, tenantId);
      }
      const capituloId = partida.capitulo_id;
      await manager.remove(BimPartida, partida);
      await this.recalcularTotalByCapitulo(capituloId, tenantId, manager);
    });
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

  async getPartidaPriceBreakdown(id: string, tenantId: string) {
    const partida = await this.findPartida(id, tenantId);
    const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId);
    const presupuesto = await this.findOne(capitulo.presupuesto_id, tenantId);
    const obra = await this.findTenantObra(presupuesto.obra_id, tenantId);

    const costoDirecto = await this.getPartidaDirectCostBreakdown(partida.id, this.partidaMaterialRepo);
    const breakdown = this.calculateProjectAwareUnitPriceBreakdown(costoDirecto, partida, presupuesto, obra);

    return {
      partida_id: partida.id,
      codigo: partida.codigo,
      descripcion: partida.descripcion,
      breakdown: {
        ...breakdown,
        costo_directo: breakdown.costo_directo.toFixed(4),
        costo_materiales: breakdown.costo_materiales.toFixed(4),
        costo_equipos: breakdown.costo_equipos.toFixed(4),
        costo_mano_obra: breakdown.costo_mano_obra.toFixed(4),
        costo_otros: breakdown.costo_otros.toFixed(4),
        base_labor: breakdown.base_labor.toFixed(4),
        labor_factor: breakdown.labor_factor.toFixed(4),
        gastos_medicos: breakdown.gastos_medicos.toFixed(4),
        subtotal_directo_ajustado: breakdown.subtotal_directo_ajustado.toFixed(4),
        administracion_pct: breakdown.administracion_pct.toFixed(2),
        utilidad_pct: breakdown.utilidad_pct.toFixed(2),
        financiamiento_pct: breakdown.financiamiento_pct.toFixed(2),
        iva_pct: breakdown.iva_pct.toFixed(2),
        base_iva: breakdown.base_iva.toFixed(4),
        total_sin_iva: breakdown.total_sin_iva.toFixed(4),
        iva_monto: breakdown.iva_monto.toFixed(4),
        total_final: breakdown.total_final.toFixed(4),
      },
    };
  }

  async recalcularPartidasConApuPorPresupuesto(
    presupuestoId: string,
    tenantId: string,
  ) {
    const arbol = await this.findWithTree(presupuestoId, tenantId);
    const flatCapitulos = this.flattenCapituloTree(arbol.capitulos);

    await this.dataSource.transaction(async (manager) => {
      for (const capitulo of flatCapitulos) {
        for (const partida of capitulo.partidas ?? []) {
          if (partida.precio_unitario_id) {
            await this.recalcularPrecioUnitarioPartida(partida.id, tenantId, manager);
          }
        }
      }
      await this.recalcularTotal(presupuestoId, tenantId, manager);
    });

    return this.findOne(presupuestoId, tenantId);
  }

  async createPartidaMaterial(
    partidaId: string,
    tenantId: string,
    dto: CreatePartidaMaterialDto,
  ): Promise<BimPartidaMaterial> {
    return this.dataSource.transaction(async (manager) => {
      const partida = await this.findPartida(partidaId, tenantId, manager);
      if (!partida.es_extra) {
        const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId, manager);
        await this.assertPresupuestoEditable(capitulo.presupuesto_id, tenantId);
      } else {
        await this.assertPartidaEditable(partida.id, tenantId);
      }
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
      await this.recalcularTotalByCapitulo(partida.capitulo_id, tenantId, manager);
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
      const partida = await this.findPartida(item.partida_id, tenantId, manager);
      if (!partida.es_extra) {
        const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId, manager);
        await this.assertPresupuestoEditable(capitulo.presupuesto_id, tenantId);
      } else {
        await this.assertPartidaEditable(partida.id, tenantId);
      }
      if (dto.recurso_id) {
        const recurso = await this.findAccessibleRecurso(dto.recurso_id, tenantId, manager);
        item.recurso_id = recurso.id;
      }
      Object.assign(item, dto);
      const saved = await manager.save(BimPartidaMaterial, item);
      await this.recalcularPrecioUnitarioPartida(item.partida_id, tenantId, manager);
      await this.recalcularTotalByCapitulo(partida.capitulo_id, tenantId, manager);
      return saved;
    });
  }

  async removePartidaMaterial(id: string, tenantId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const item = await this.findPartidaMaterial(id, tenantId, manager);
      const partidaId = item.partida_id;
      const partida = await this.findPartida(partidaId, tenantId, manager);
      if (!partida.es_extra) {
        const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId, manager);
        await this.assertPresupuestoEditable(capitulo.presupuesto_id, tenantId);
      } else {
        await this.assertPartidaEditable(partida.id, tenantId);
      }
      await manager.remove(BimPartidaMaterial, item);
      await this.recalcularPrecioUnitarioPartida(partidaId, tenantId, manager);
      await this.recalcularTotalByCapitulo(partida.capitulo_id, tenantId, manager);
    });
  }

  // ── Recalcular total del presupuesto ────────────────────
  async recalcularTotal(
    presupuestoId: string,
    tenantId: string,
    manager?: any,
  ): Promise<BimPresupuesto> {
    const partidaRepo = manager ? manager.getRepository(BimPartida) : this.partidaRepo;
    const presupuestoRepo = manager
      ? manager.getRepository(BimPresupuesto)
      : this.presupuestoRepo;

    const result = await partidaRepo
      .createQueryBuilder('p')
      .innerJoin('bim_capitulos', 'c', 'c.id = p.capitulo_id')
      .where('c.presupuesto_id = :presupuestoId', { presupuestoId })
      .select('SUM(p.importe_total)', 'total')
      .getRawOne();

    const totalPartidas = parseFloat((result as { total?: string } | null)?.total ?? '0');
    const presupuesto = manager
      ? await presupuestoRepo.findOne({ where: { id: presupuestoId, tenant_id: tenantId } })
      : await this.findOne(presupuestoId, tenantId);

    if (!presupuesto) {
      throw new NotFoundException(`Presupuesto #${presupuestoId} no encontrado`);
    }

    presupuesto.total_presupuesto = totalPartidas.toFixed(2);
    return presupuestoRepo.save(presupuesto);
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

    const partida = await this.findPartida(partidaId, tenantId, manager);
    const capitulo = await this.findCapitulo(partida.capitulo_id, tenantId, manager);
    const presupuestoRepo = manager ? manager.getRepository(BimPresupuesto) : this.presupuestoRepo;
    const obraRepo = manager ? manager.getRepository(BimObra) : this.obraRepo;
    const presupuesto = await presupuestoRepo.findOne({ where: { id: capitulo.presupuesto_id, tenant_id: tenantId } });
    const obra = presupuesto ? await obraRepo.findOne({ where: { id: presupuesto.obra_id, tenant_id: tenantId } }) : null;

    const costoDirecto = await this.getPartidaDirectCostBreakdown(partidaId, materialRepo);
    const breakdown = this.calculateProjectAwareUnitPriceBreakdown(costoDirecto, partida, presupuesto, obra);
    partida.precio_unitario = breakdown.total_final.toFixed(4);
    await partidaRepo.save(partida);
  }

  private async getPartidaDirectCostBreakdown(
    partidaId: string,
    materialRepo: Repository<BimPartidaMaterial>,
  ): Promise<PartidaDirectCostBreakdown> {
    const rows = await materialRepo
      .createQueryBuilder('material')
      .where('material.partida_id = :partidaId', { partidaId })
      .select('material.tipo', 'tipo')
      .addSelect('SUM(material.total)', 'total')
      .groupBy('material.tipo')
      .getRawMany<{ tipo?: string | null; total?: string | null }>();

    const breakdown: PartidaDirectCostBreakdown = {
      total: 0,
      materiales: 0,
      equipos: 0,
      mano_obra: 0,
      otros: 0,
    };

    for (const row of rows) {
      const total = parseFloat(row.total ?? '0') || 0;
      breakdown.total += total;

      switch (row.tipo) {
        case 'material':
          breakdown.materiales += total;
          break;
        case 'equipo':
          breakdown.equipos += total;
          break;
        case 'mano_obra':
          breakdown.mano_obra += total;
          break;
        default:
          breakdown.otros += total;
          break;
      }
    }

    return breakdown;
  }

  private calculateProjectAwareUnitPriceBreakdown(
    costoDirecto: PartidaDirectCostBreakdown,
    partida: BimPartida,
    presupuesto: BimPresupuesto | null,
    obra: BimObra | null,
  ): ProjectAwareUnitPriceBreakdown {
    const costoMateriales = costoDirecto.materiales;
    const costoEquipos = costoDirecto.equipos;
    const costoManoObra = costoDirecto.mano_obra;
    const costoOtros = costoDirecto.otros;
    const costoDirectoTotal = costoDirecto.total;

    if (!partida.precio_unitario_id || !presupuesto || !obra) {
      return {
        costo_directo: costoDirectoTotal,
        costo_materiales: costoMateriales,
        costo_equipos: costoEquipos,
        costo_mano_obra: costoManoObra,
        costo_otros: costoOtros,
        base_labor: 0,
        labor_factor: 0,
        gastos_medicos: 0,
        subtotal_directo_ajustado: costoDirectoTotal,
        administracion_pct: 0,
        utilidad_pct: 0,
        financiamiento_pct: 0,
        iva_pct: 0,
        iva_modo: 'sin_iva',
        base_iva: 0,
        financiamiento_incluye_utilidad: false,
        total_sin_iva: costoDirectoTotal,
        iva_monto: 0,
        total_final: costoDirectoTotal,
      };
    }

    const meta = (obra.meta_json ?? {}) as {
      iva?: { modo?: string | null; porcentaje?: number | string | null };
      costos_indirectos?: {
        administracion_pct?: number | string | null;
        utilidad_pct?: number | string | null;
        financiamiento_pct?: number | string | null;
        financiamiento_incluye_utilidad?: boolean;
      };
      costos_salario?: {
        aplicar_doble_factor?: boolean;
        factor_labor_directa?: number | string | null;
      };
      otros_factores?: {
        usar_gastos_medicos?: boolean;
  };
};

type PresupuestoTreeCapitulo = BimCapitulo & {
  partidas: BimPartida[];
  children: PresupuestoTreeCapitulo[];
};

    const ivaModo = meta.iva?.modo ?? 'presupuesto_y_valuacion';
    const ivaPct = this.toNumber(meta.iva?.porcentaje ?? presupuesto.iva_pct) / 100;
    const administracionPct = this.toNumber(meta.costos_indirectos?.administracion_pct ?? presupuesto.gastos_indirectos_pct) / 100;
    const utilidadPct = this.toNumber(meta.costos_indirectos?.utilidad_pct ?? presupuesto.beneficio_pct) / 100;
    const financiamientoPct = this.toNumber(meta.costos_indirectos?.financiamiento_pct ?? '0') / 100;
    const financiamientoIncluyeUtilidad = Boolean(meta.costos_indirectos?.financiamiento_incluye_utilidad);
    const factorLaborDirecta = this.toNumber(meta.costos_salario?.factor_labor_directa ?? '0') / 100;
    const aplicarDobleFactor = Boolean(meta.costos_salario?.aplicar_doble_factor);
    const usarGastosMedicos = Boolean(meta.otros_factores?.usar_gastos_medicos);

    const baseLabor = factorLaborDirecta > 0 ? costoDirectoTotal * factorLaborDirecta : 0;
    const laborFactor = aplicarDobleFactor ? baseLabor * 2 : baseLabor;
    const gastosMedicos = usarGastosMedicos ? costoDirectoTotal * 0.01 : 0;
    const subtotalMateriales = costoMateriales;
    const subtotalEquipos = costoEquipos;
    const subtotalManoObra = costoManoObra + laborFactor + gastosMedicos;
    const subtotalOtros = costoOtros;
    const subtotalDirectoAjustado =
      subtotalMateriales + subtotalEquipos + subtotalManoObra + subtotalOtros;

    const aplicarCargosProyecto = (base: number) => {
      const baseConIndirectos = base * (1 + administracionPct + utilidadPct);
      const financiamientoBase = financiamientoIncluyeUtilidad
        ? base * (1 + administracionPct + utilidadPct)
        : base * (1 + administracionPct);
      return baseConIndirectos + financiamientoBase * financiamientoPct;
    };

    const totalSinIva = aplicarCargosProyecto(subtotalDirectoAjustado);

    let baseIvaDirecta = subtotalDirectoAjustado;
    if (ivaModo === 'sin_iva' || ivaModo === 'solo_valuacion') {
      baseIvaDirecta = 0;
    } else if (ivaModo === 'materiales') {
      baseIvaDirecta = subtotalMateriales;
    } else if (ivaModo === 'materiales_equipos') {
      baseIvaDirecta = subtotalMateriales + subtotalEquipos;
    }

    const baseIva = aplicarCargosProyecto(baseIvaDirecta);
    const ivaMonto = baseIva * ivaPct;
    const totalFinal = totalSinIva + ivaMonto;

    return {
      costo_directo: costoDirectoTotal,
      costo_materiales: costoMateriales,
      costo_equipos: costoEquipos,
      costo_mano_obra: costoManoObra,
      costo_otros: costoOtros,
      base_labor: baseLabor,
      labor_factor: laborFactor,
      gastos_medicos: gastosMedicos,
      subtotal_directo_ajustado: subtotalDirectoAjustado,
      administracion_pct: administracionPct * 100,
      utilidad_pct: utilidadPct * 100,
      financiamiento_pct: financiamientoPct * 100,
      iva_pct: ivaPct * 100,
      iva_modo: ivaModo,
      base_iva: baseIva,
      financiamiento_incluye_utilidad: financiamientoIncluyeUtilidad,
      total_sin_iva: totalSinIva,
      iva_monto: ivaMonto,
      total_final: totalFinal,
    };
  }

  private toNumber(value: string | number | null | undefined) {
    return Number.parseFloat(String(value ?? '0')) || 0;
  }

  private flattenCapituloTree(
    capitulos: PresupuestoTreeCapitulo[],
  ): Array<PresupuestoTreeCapitulo & { depth: number }> {
    const rows: Array<PresupuestoTreeCapitulo & { depth: number }> = [];

    const walk = (nodes: PresupuestoTreeCapitulo[], depth: number) => {
      for (const node of nodes) {
        rows.push({ ...node, depth });
        if (node.children?.length) {
          walk(node.children, depth + 1);
        }
      }
    };

    walk(capitulos, 0);
    return rows;
  }

  private async findDescendantCapituloIds(id: string, tenantId: string) {
    const capitulos = await this.capituloRepo
      .createQueryBuilder('capitulo')
      .innerJoin(BimPresupuesto, 'presupuesto', 'presupuesto.id = capitulo.presupuesto_id')
      .where('presupuesto.tenant_id = :tenantId', { tenantId })
      .select(['capitulo.id AS id', 'capitulo.parent_id AS parent_id'])
      .getRawMany<{ id: string; parent_id: string | null }>();

    const childrenByParent = new Map<string, string[]>();
    for (const capitulo of capitulos) {
      if (!capitulo.parent_id) continue;
      const rows = childrenByParent.get(String(capitulo.parent_id)) ?? [];
      rows.push(String(capitulo.id));
      childrenByParent.set(String(capitulo.parent_id), rows);
    }

    const descendants: string[] = [];
    const visit = (parentId: string) => {
      for (const childId of childrenByParent.get(parentId) ?? []) {
        descendants.push(childId);
        visit(childId);
      }
    };

    visit(String(id));
    return descendants;
  }

  private async recalcularTotalByCapitulo(
    capituloId: string,
    tenantId: string,
    manager?: any,
  ): Promise<BimPresupuesto> {
    const repo = manager ? manager.getRepository(BimCapitulo) : this.capituloRepo;
    const capitulo = await repo.findOne({ where: { id: capituloId } });
    if (!capitulo) {
      throw new NotFoundException(`Capítulo #${capituloId} no encontrado`);
    }
    return this.recalcularTotal(capitulo.presupuesto_id, tenantId, manager);
  }

  private async buildPresupuestoModificadoDetalle(
    presupuestoBase: BimPresupuesto,
    tenantId: string,
  ): Promise<PresupuestoModificadoDetalle[]> {
    const capitulos = await this.capituloRepo.find({
      where: { presupuesto_id: presupuestoBase.id },
      order: { orden: 'ASC', id: 'ASC' },
    });

    const baseRows = (
      await Promise.all(
        capitulos.map(async (capitulo) => {
          const partidas = await this.partidaRepo.find({
            where: { capitulo_id: capitulo.id },
            order: { orden: 'ASC', id: 'ASC' },
          });

          return partidas.map((partida) => ({ capitulo, partida }));
        }),
      )
    ).flat();

    const documentosValidos = await this.findDocumentosFuenteModificado(
      presupuestoBase.id,
      tenantId,
    );
    const documentoIds = documentosValidos.map((item) => item.id);

    const variaciones = documentoIds.length
      ? await this.reconsideracionRepo
          .createQueryBuilder('rec')
          .where('rec.tenant_id = :tenantId', { tenantId })
          .andWhere('rec.documento_id IN (:...documentoIds)', { documentoIds })
          .orderBy('rec.id', 'ASC')
          .getMany()
      : [];

    const aumentosMap = new Map<string, number>();
    const disminucionesMap = new Map<string, number>();
    const extrasMap = new Map<
      string,
      {
        partida_base_id: string;
        capitulo_base_id: string;
        codigo: string;
        descripcion: string;
        unidad: string;
        orden: number;
        precio_unitario: number;
        cantidad_extra: number;
      }
    >();

    for (const item of variaciones) {
      const partidaId = String(item.partida_id);
      const cantidad = Math.abs(this.toNumber(item.cantidad_variacion));

      if (item.tipo === 'aumento') {
        aumentosMap.set(partidaId, (aumentosMap.get(partidaId) ?? 0) + cantidad);
        continue;
      }

      if (item.tipo === 'disminucion') {
        disminucionesMap.set(
          partidaId,
          (disminucionesMap.get(partidaId) ?? 0) + cantidad,
        );
        continue;
      }

      if (item.tipo === 'extra') {
        const partidaExtra = await this.partidaRepo.findOne({
          where: { id: item.partida_id },
        });
        if (!partidaExtra) continue;

        extrasMap.set(partidaId, {
          partida_base_id: partidaId,
          capitulo_base_id: String(partidaExtra.capitulo_id),
          codigo: partidaExtra.codigo,
          descripcion: partidaExtra.descripcion,
          unidad: partidaExtra.unidad,
          orden: partidaExtra.orden,
          precio_unitario: this.toNumber(item.precio_unitario || partidaExtra.precio_unitario),
          cantidad_extra: cantidad,
        });
      }
    }

    const detalleBase = baseRows.map(({ capitulo, partida }) => {
      const cantidadOriginal = this.toNumber(partida.cantidad);
      const precioUnitario = this.toNumber(partida.precio_unitario);
      const cantidadAumento = aumentosMap.get(String(partida.id)) ?? 0;
      const cantidadDisminucion = disminucionesMap.get(String(partida.id)) ?? 0;
      const cantidadModificada = Math.max(
        cantidadOriginal + cantidadAumento - cantidadDisminucion,
        0,
      );

      return {
        partida_base_id: String(partida.id),
        capitulo_base_id: String(capitulo.id),
        codigo: partida.codigo,
        descripcion: partida.descripcion,
        unidad: partida.unidad,
        orden: partida.orden,
        capitulo_codigo: capitulo.codigo,
        capitulo_nombre: capitulo.nombre,
        capitulo_orden: capitulo.orden,
        cantidad_original: cantidadOriginal,
        precio_unitario: precioUnitario,
        cantidad_aumento: cantidadAumento,
        cantidad_disminucion: cantidadDisminucion,
        cantidad_extra: 0,
        cantidad_modificada: cantidadModificada,
        monto_original: cantidadOriginal * precioUnitario,
        monto_modificado: cantidadModificada * precioUnitario,
        es_extra: false,
      } as PresupuestoModificadoDetalle;
    });

    const capitulosById = new Map(
      capitulos.map((capitulo) => [String(capitulo.id), capitulo]),
    );

    const detalleExtras = Array.from(extrasMap.values()).map((item) => {
      const capitulo = capitulosById.get(item.capitulo_base_id);
      return {
        partida_base_id: item.partida_base_id,
        capitulo_base_id: item.capitulo_base_id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad: item.unidad,
        orden: item.orden,
        capitulo_codigo: capitulo?.codigo ?? 'EX',
        capitulo_nombre: capitulo?.nombre ?? 'Obras extras',
        capitulo_orden: capitulo?.orden ?? 999,
        cantidad_original: 0,
        precio_unitario: item.precio_unitario,
        cantidad_aumento: 0,
        cantidad_disminucion: 0,
        cantidad_extra: item.cantidad_extra,
        cantidad_modificada: item.cantidad_extra,
        monto_original: 0,
        monto_modificado: item.cantidad_extra * item.precio_unitario,
        es_extra: true,
      } as PresupuestoModificadoDetalle;
    });

    return [...detalleBase, ...detalleExtras].sort((a, b) => {
      if (a.capitulo_orden !== b.capitulo_orden) {
        return a.capitulo_orden - b.capitulo_orden;
      }
      if (a.capitulo_codigo !== b.capitulo_codigo) {
        return a.capitulo_codigo.localeCompare(b.capitulo_codigo);
      }
      if (a.orden !== b.orden) {
        return a.orden - b.orden;
      }
      return a.codigo.localeCompare(b.codigo);
    });
  }

  private async resolvePresupuestoBase(
    presupuestoId: string,
    tenantId: string,
  ): Promise<BimPresupuesto> {
    const presupuesto = await this.findOne(presupuestoId, tenantId);
    if (
      presupuesto.tipo === 'modificado' &&
      presupuesto.presupuesto_base_id
    ) {
      return this.findOne(presupuesto.presupuesto_base_id, tenantId);
    }

    return presupuesto;
  }

  private async findPresupuestoOriginalOficial(
    obraId: string,
    tenantId: string,
  ): Promise<BimPresupuesto | null> {
    const oficial = await this.presupuestoRepo.findOne({
      where: {
        tenant_id: tenantId,
        obra_id: obraId,
        es_oficial: true,
        tipo: 'obra',
      },
      order: { version: 'DESC', updated_at: 'DESC' },
    });
    if (oficial) return oficial;

    const sinApuOficial = await this.presupuestoRepo.findOne({
      where: {
        tenant_id: tenantId,
        obra_id: obraId,
        es_oficial: true,
        tipo: 'sin_apu',
      },
      order: { version: 'DESC', updated_at: 'DESC' },
    });
    if (sinApuOficial) return sinApuOficial;

    return null;
  }

  private async findDocumentosFuenteModificado(
    presupuestoBaseId: string,
    tenantId: string,
  ): Promise<BimReconsideracionDocumento[]> {
    return this.reconsideracionDocumentoRepo.find({
      where: {
        tenant_id: tenantId,
        presupuesto_id: presupuestoBaseId,
      },
      order: { numero: 'ASC', id: 'ASC' },
    }).then((rows) =>
      rows.filter(
        (item) =>
          ['aumento', 'disminucion', 'extra'].includes(item.tipo) &&
          ['revisado', 'aprobado'].includes(item.status),
      ),
    );
  }

  private async listPresupuestoModificadoFuentes(
    presupuestoId: string,
    tenantId: string,
  ): Promise<
    Array<{
      documento_id: string;
      tipo: string;
      numero: number;
      fecha: string;
      titulo: string;
      status: string;
    }>
  > {
    const fuentes = await this.presupuestoModificadoFuenteRepo.find({
      where: {
        tenant_id: tenantId,
        presupuesto_id: presupuestoId,
      },
      relations: ['documento'],
      order: { id: 'ASC' },
    });

    return fuentes
      .filter((item) => item.documento)
      .map((item) => ({
        documento_id: item.documento.id,
        tipo: item.documento.tipo,
        numero: item.documento.numero,
        fecha: item.documento.fecha,
        titulo: item.documento.titulo,
        status: item.documento.status,
      }));
  }

  private async assertPresupuestoEditable(
    presupuestoId: string,
    tenantId: string,
  ): Promise<void> {
    const [mediciones, valuaciones, reconsideraciones] = await Promise.all([
      this.medicionDocumentoRepo.count({
        where: { tenant_id: tenantId, presupuesto_id: presupuestoId },
      }),
      this.certificacionRepo.count({
        where: { tenant_id: tenantId, presupuesto_id: presupuestoId },
      }),
      this.reconsideracionDocumentoRepo.count({
        where: { tenant_id: tenantId, presupuesto_id: presupuestoId },
      }),
    ]);

    if (mediciones > 0 || valuaciones > 0 || reconsideraciones > 0) {
      throw new BadRequestException(
        'El presupuesto está protegido por historial operativo. Usa módulos formales como extras, aumentos, disminuciones o reconsideraciones.',
      );
    }
  }

  private async assertPartidaEditable(
    partidaId: string,
    tenantId: string,
  ): Promise<void> {
    const [mediciones, valuaciones, reconsideraciones] = await Promise.all([
      this.medicionRepo.count({
        where: { tenant_id: tenantId, partida_id: partidaId },
      }),
      this.lineaCertRepo.count({
        where: { partida_id: partidaId },
      }),
      this.reconsideracionRepo.count({
        where: { tenant_id: tenantId, partida_id: partidaId },
      }),
    ]);

    if (mediciones > 0 || valuaciones > 0 || reconsideraciones > 0) {
      throw new BadRequestException(
        'La partida ya tiene historial operativo y no puede editarse libremente.',
      );
    }
  }

  private renderPdfHeader(
    doc: PDFKit.PDFDocument,
    presupuesto: BimPresupuesto,
    chapterCount: number,
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#111827')
      .text('PRESUPUESTO DE OBRA');

    doc.moveDown(0.4);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#4b5563')
      .text(`Proyecto: ${presupuesto.obra?.codigo ?? ''} - ${presupuesto.obra?.nombre ?? ''}`)
      .text(`Presupuesto: v${presupuesto.version} - ${presupuesto.nombre}`)
      .text(`Estado: ${presupuesto.estado}    Moneda: ${presupuesto.moneda}    Fecha: ${new Date().toLocaleDateString('es-ES')}`)
      .text(`Capitulos: ${chapterCount}`);

    doc.moveDown(0.8);
  }

  private renderPdfSummary(
    doc: PDFKit.PDFDocument,
    presupuesto: BimPresupuesto,
    partidaCount: number,
  ) {
    const top = doc.y;
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc
      .roundedRect(left, top, width, 54, 8)
      .fillAndStroke('#f9fafb', '#e5e7eb');

    const labels = [
      ['Partidas', String(partidaCount)],
      ['Indirectos', `${Number(presupuesto.gastos_indirectos_pct ?? '0').toFixed(2)}%`],
      ['Beneficio', `${Number(presupuesto.beneficio_pct ?? '0').toFixed(2)}%`],
      ['IVA', `${Number(presupuesto.iva_pct ?? '0').toFixed(2)}%`],
    ] as const;

    const colWidth = width / labels.length;
    labels.forEach(([label, value], index) => {
      const x = left + index * colWidth;
      doc
        .fillColor('#6b7280')
        .font('Helvetica')
        .fontSize(8)
        .text(label, x + 12, top + 10, { width: colWidth - 24, align: 'left' })
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(value, x + 12, top + 24, { width: colWidth - 24, align: 'left' });
    });

    doc.y = top + 68;
  }

  private renderPdfPartidasTable(
    doc: PDFKit.PDFDocument,
    partidas: BimPartida[],
    currency: string,
  ) {
    const startX = doc.page.margins.left;
    const widths = [74, 232, 44, 54, 62, 70];
    const headers = ['Codigo', 'Descripcion', 'Und', 'Cant.', 'P.U.', 'Total'];
    const headerTop = doc.y;

    doc
      .roundedRect(startX, headerTop, widths.reduce((sum, item) => sum + item, 0), 22, 4)
      .fill('#eef2f7');

    let cursorX = startX;
    headers.forEach((header, index) => {
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(header, cursorX + 6, headerTop + 7, {
          width: widths[index] - 12,
          align: index >= 3 ? 'right' : 'left',
        });
      cursorX += widths[index];
    });

    doc.y = headerTop + 26;

    partidas.forEach((partida, index) => {
      const rowTop = doc.y;
      const descripcionHeight = doc.heightOfString(partida.descripcion, {
        width: widths[1] - 12,
        align: 'left',
      });
      const rowHeight = Math.max(18, descripcionHeight + 8);

      this.ensurePdfSpace(doc, rowHeight + 8);

      if (index % 2 === 0) {
        doc
          .rect(startX, rowTop, widths.reduce((sum, item) => sum + item, 0), rowHeight)
          .fill('#fcfcfd');
      }

      let x = startX;
      const values = [
        partida.codigo,
        partida.descripcion,
        partida.unidad,
        Number(partida.cantidad).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        this.formatCurrency(partida.precio_unitario, currency),
        this.formatCurrency(partida.importe_total, currency),
      ];

      values.forEach((value, valueIndex) => {
        doc
          .fillColor('#111827')
          .font(valueIndex === 1 ? 'Helvetica' : 'Helvetica')
          .fontSize(8)
          .text(value, x + 6, rowTop + 4, {
            width: widths[valueIndex] - 12,
            align: valueIndex >= 3 ? 'right' : 'left',
          });
        x += widths[valueIndex];
      });

      doc.y = rowTop + rowHeight;
    });
  }

  private renderPdfCapitulo(
    doc: PDFKit.PDFDocument,
    capitulo: PresupuestoTreeCapitulo & { depth: number },
    currency: string,
  ) {
    this.ensurePdfSpace(doc, 70);
    const indent = capitulo.depth * 18;
    doc
      .font(capitulo.depth === 0 ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(capitulo.depth === 0 ? 11 : 10)
      .fillColor('#1f2937')
      .text(`${capitulo.codigo}  ${capitulo.nombre}`, doc.page.margins.left + indent, doc.y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - indent,
      });
    doc.moveDown(0.3);

    if (capitulo.partidas?.length) {
      this.renderPdfPartidasTable(doc, capitulo.partidas ?? [], currency);
      doc.moveDown(0.8);
      return;
    }

    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#6b7280')
      .text('Sin partidas directas en este capítulo', doc.page.margins.left + indent + 12, doc.y);
    doc.moveDown(0.8);
  }

  private ensurePdfSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
    if (doc.y + requiredHeight <= doc.page.height - doc.page.margins.bottom) {
      return;
    }
    doc.addPage();
  }

  private formatCurrency(value: number | string | null | undefined, currency = 'USD') {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isNaN(parsed) ? 0 : parsed);
  }
}
