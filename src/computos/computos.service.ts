import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BimComputo } from '../database/entities/bim/bim-computo.entity';
import { BimComputoDocumento } from '../database/entities/bim/bim-computo-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateComputoDocumentoDto } from './dto/create-computo-documento.dto';
import { UpdateComputoDocumentoDto } from './dto/update-computo-documento.dto';
import { SaveComputoDetallesDto } from './dto/save-computo-detalles.dto';
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

@Injectable()
export class ComputosService {
  constructor(
    @InjectRepository(BimComputo)
    private readonly computoRepo: Repository<BimComputo>,
    @InjectRepository(BimComputoDocumento)
    private readonly documentoRepo: Repository<BimComputoDocumento>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    private readonly dataSource: DataSource,
  ) {}

  async createDocumento(
    dto: CreateComputoDocumentoDto,
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
    const titulo = dto.titulo?.trim() || `COMPUTOS METRICOS Nro. ${numero}`;

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
      where.presupuesto_id = presupuestoId;
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
      throw new NotFoundException(`Documento de cómputo #${id} no encontrado`);
    }

    return documento;
  }

  async updateDocumento(
    id: string,
    tenantId: string,
    dto: UpdateComputoDocumentoDto,
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

    return this.documentoRepo.save(documento);
  }

  async getDocumentoResumen(id: string, tenantId: string) {
    const documento = await this.findDocumento(id, tenantId);
    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const actuales = await this.computoRepo.find({
      where: { documento_id: documento.id, tenant_id: tenantId },
      order: { id: 'ASC' },
    });

    const actualesByPartida = new Map(actuales.map((item) => [String(item.partida_id), item]));

    const detalle = partidas.map((partida, index) => {
      const actual = actualesByPartida.get(String(partida.id));
      const resultado = actual ? this.toNumber(actual.resultado) : 0;
      const precioUnitario = this.toNumber(partida.precio_unitario);
      const total = resultado * precioUnitario;

      return {
        partida_id: partida.id,
        nro: index + 1,
        codigo: partida.codigo,
        descripcion_partida: partida.descripcion,
        unidad: partida.unidad,
        cantidad_presupuesto: this.toNumber(partida.cantidad).toFixed(4),
        descripcion_computo: actual?.descripcion ?? partida.descripcion,
        formula_tipo: actual?.formula_tipo ?? 'directo',
        cantidad: this.toNumber(actual?.cantidad ?? '0').toFixed(4),
        largo: this.toNumber(actual?.largo ?? '0').toFixed(4),
        ancho: this.toNumber(actual?.ancho ?? '0').toFixed(4),
        alto: this.toNumber(actual?.alto ?? '0').toFixed(4),
        resultado: resultado.toFixed(4),
        precio_unitario: precioUnitario.toFixed(4),
        total: total.toFixed(2),
        notas: actual?.notas ?? null,
      };
    });

    const totalComputado = detalle.reduce((sum, item) => sum + this.toNumber(item.resultado), 0);
    const totalPresupuesto = detalle.reduce((sum, item) => sum + this.toNumber(item.cantidad_presupuesto), 0);
    const totalMonto = detalle.reduce((sum, item) => sum + this.toNumber(item.total), 0);

    return {
      documento,
      resumen: {
        partidas: detalle.length,
        presupuesto_base: totalPresupuesto.toFixed(4),
        computado_total: totalComputado.toFixed(4),
        monto_total: totalMonto.toFixed(2),
      },
      detalle,
    };
  }

  async saveDocumentoDetalles(
    id: string,
    userId: string,
    tenantId: string,
    dto: SaveComputoDetallesDto,
  ) {
    const documento = await this.findDocumento(id, tenantId);

    if (documento.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar documentos en borrador');
    }

    const partidas = await this.findPresupuestoPartidas(documento.presupuesto_id, tenantId);
    const partidasMap = new Map(partidas.map((item) => [String(item.id), item]));

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BimComputo);
      const existentes = await repo.find({
        where: { documento_id: documento.id, tenant_id: tenantId },
      });
      const existentesByPartida = new Map(existentes.map((item) => [String(item.partida_id), item]));
      const payload = new Map(dto.detalles.map((item) => [String(item.partida_id), item]));

      for (const [partidaId, partida] of partidasMap.entries()) {
        const item = payload.get(partidaId);
        const existente = existentesByPartida.get(partidaId);

        if (!item) {
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
          created_by: userId,
        });

        row.tenant_id = tenantId;
        row.obra_id = documento.obra_id;
        row.documento_id = documento.id;
        row.partida_id = partidaId;
        row.created_by = userId;
        row.descripcion = item.descripcion?.trim() || partida.descripcion;
        row.formula_tipo = item.formula_tipo;
        row.cantidad = this.toNumber(item.cantidad).toFixed(4);
        row.largo = this.toNumber(item.largo).toFixed(4);
        row.ancho = this.toNumber(item.ancho).toFixed(4);
        row.alto = this.toNumber(item.alto).toFixed(4);
        row.resultado = this.calculateResult(row).toFixed(4);
        row.notas = item.notas ?? null;

        await repo.save(row);
      }
    });

    return this.getDocumentoResumen(documento.id, tenantId);
  }

  async syncDocumentoToPresupuesto(id: string, tenantId: string) {
    const documento = await this.findDocumento(id, tenantId);
    const computos = await this.computoRepo.find({
      where: { documento_id: documento.id, tenant_id: tenantId },
    });

    await this.dataSource.transaction(async (manager) => {
      const partidaRepo = manager.getRepository(BimPartida);
      const presupuestoRepo = manager.getRepository(BimPresupuesto);

      for (const computo of computos) {
        const partida = await partidaRepo.findOne({ where: { id: computo.partida_id } });
        if (!partida) continue;
        partida.cantidad = computo.resultado;
        partida.importe_total = (
          this.toNumber(partida.cantidad) * this.toNumber(partida.precio_unitario)
        ).toFixed(2);
        await partidaRepo.save(partida);
      }

      const result = await partidaRepo
        .createQueryBuilder('p')
        .innerJoin('bim_capitulos', 'c', 'c.id = p.capitulo_id')
        .where('c.presupuesto_id = :presupuestoId', {
          presupuestoId: documento.presupuesto_id,
        })
        .select('SUM(p.importe_total)', 'total')
        .getRawOne<{ total?: string }>();

      const presupuesto = await presupuestoRepo.findOne({
        where: { id: documento.presupuesto_id, tenant_id: tenantId },
      });

      if (!presupuesto) {
        throw new NotFoundException(
          `Presupuesto #${documento.presupuesto_id} no encontrado`,
        );
      }

      const totalPartidas = this.toNumber(result?.total ?? '0');
      const gastosIndirectos = this.toNumber(presupuesto.gastos_indirectos_pct) / 100;
      const beneficio = this.toNumber(presupuesto.beneficio_pct) / 100;
      const iva = this.toNumber(presupuesto.iva_pct) / 100;

      presupuesto.total_presupuesto = (
        totalPartidas *
        (1 + gastosIndirectos + beneficio) *
        (1 + iva)
      ).toFixed(2);

      await presupuestoRepo.save(presupuesto);
    });

    return {
      message: 'Cantidades del presupuesto actualizadas desde el documento de cómputos.',
      documento_id: documento.id,
      partidas_actualizadas: computos.length,
    };
  }

  private calculateResult(
    input: Pick<
      BimComputo,
      'formula_tipo' | 'cantidad' | 'largo' | 'ancho' | 'alto'
    >,
  ) {
    const cantidad = this.toNumber(input.cantidad);
    const largo = this.toNumber(input.largo);
    const ancho = this.toNumber(input.ancho);
    const alto = this.toNumber(input.alto);

    switch (input.formula_tipo) {
      case 'largo':
        return cantidad * largo;
      case 'largo_x_ancho':
        return cantidad * largo * ancho;
      case 'largo_x_ancho_x_alto':
        return cantidad * largo * ancho * alto;
      case 'directo':
      default:
        return cantidad;
    }
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
    return presupuesto;
  }

  private async nextNumero(tenantId: string, presupuestoId: string) {
    const last = await this.documentoRepo.findOne({
      where: { tenant_id: tenantId, presupuesto_id: presupuestoId },
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
