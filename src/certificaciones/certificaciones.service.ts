import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import {
  CreateCertificacionDto,
  CreateLineaCertificacionDto,
  AprobarCertificacionDto,
} from './dto/create-certificacion.dto';

@Injectable()
export class CertificacionesService {
  constructor(
    @InjectRepository(BimCertificacion)
    private readonly certRepo: Repository<BimCertificacion>,
    @InjectRepository(BimLineaCertificacion)
    private readonly lineaRepo: Repository<BimLineaCertificacion>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
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
    await this.findTenantPresupuesto(dto.presupuesto_id, tenantId);
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
        numero,
        periodo_desde: dto.periodo_desde as unknown as Date,
        periodo_hasta: dto.periodo_hasta as unknown as Date,
        observaciones: dto.observaciones,
        created_by: userId,
      });
      const saved = await manager.save(BimCertificacion, cert);

      if (dto.lineas?.length) {
        await this.saveLineas(manager, saved.id, dto.lineas);
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

  async findByObra(obraId: string, tenantId: string): Promise<BimCertificacion[]> {
    await this.findTenantObra(obraId, tenantId);
    return this.certRepo.find({
      where: { obra_id: obraId, tenant_id: tenantId },
      order: { numero: 'ASC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const cert = await this.certRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'presupuesto', 'creator', 'aprobador'],
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
    const obra = await this.obraRepo.findOne({ where: { id, tenant_id: tenantId } });
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
}
