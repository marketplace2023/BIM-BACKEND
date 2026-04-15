import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { BimContratista } from '../database/entities/bim/bim-contratista.entity';
import { BimObraContratista } from '../database/entities/bim/bim-obra-contratista.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { CreateContratistaDto } from './dto/create-contratista.dto';
import { UpdateContratistaDto } from './dto/update-contratista.dto';
import { AsignarContratistaDto } from './dto/asignar-contratista.dto';

@Injectable()
export class ContratistasService {
  constructor(
    @InjectRepository(BimContratista)
    private readonly contratistaRepo: Repository<BimContratista>,
    @InjectRepository(BimObraContratista)
    private readonly obraContratistaRepo: Repository<BimObraContratista>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
  ) {}

  async create(
    dto: CreateContratistaDto,
    tenantId: string,
  ): Promise<BimContratista> {
    if (dto.rut_nif) {
      const exists = await this.contratistaRepo.findOne({
        where: { rut_nif: dto.rut_nif, tenant_id: tenantId },
      });
      if (exists) {
        throw new ConflictException(
          `Ya existe un contratista con RUT/NIF "${dto.rut_nif}"`,
        );
      }
    }
    const contratista = this.contratistaRepo.create({
      ...dto,
      tenant_id: tenantId,
    });
    return this.contratistaRepo.save(contratista);
  }

  async findAll(tenantId: string, estado?: string): Promise<BimContratista[]> {
    const where: any = { deleted_at: IsNull(), tenant_id: tenantId };
    if (estado) where.estado = estado;
    return this.contratistaRepo.find({ where, order: { nombre: 'ASC' } });
  }

  async findOne(id: string, tenantId: string): Promise<BimContratista> {
    const c = await this.contratistaRepo.findOne({
      where: { id, tenant_id: tenantId, deleted_at: IsNull() },
    });
    if (!c) throw new NotFoundException(`Contratista #${id} no encontrado`);
    return c;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateContratistaDto,
  ): Promise<BimContratista> {
    const c = await this.findOne(id, tenantId);
    if (dto.rut_nif && dto.rut_nif !== c.rut_nif) {
      const dup = await this.contratistaRepo.findOne({
        where: { rut_nif: dto.rut_nif, tenant_id: tenantId },
      });
      if (dup)
        throw new ConflictException(`RUT/NIF "${dto.rut_nif}" ya en uso`);
    }
    Object.assign(c, dto);
    return this.contratistaRepo.save(c);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const c = await this.findOne(id, tenantId);
    await this.contratistaRepo.softRemove(c);
  }

  // ── Asignación a obra ──────────────────────────────────
  async asignarAObra(
    obraId: string,
    dto: AsignarContratistaDto,
    tenantId: string,
  ): Promise<BimObraContratista> {
    await this.findTenantObra(obraId, tenantId);
    await this.findOne(dto.contratista_id, tenantId);
    const existing = await this.obraContratistaRepo.findOne({
      where: { obra_id: obraId, contratista_id: dto.contratista_id },
    });
    if (existing) {
      throw new ConflictException(
        'Este contratista ya está asignado a la obra',
      );
    }
    const asignacion = this.obraContratistaRepo.create({
      obra_id: obraId,
      ...dto,
    });
    return this.obraContratistaRepo.save(asignacion);
  }

  async findByObra(
    obraId: string,
    tenantId: string,
  ): Promise<BimObraContratista[]> {
    await this.findTenantObra(obraId, tenantId);
    return this.obraContratistaRepo.find({
      where: { obra_id: obraId },
      relations: ['contratista'],
      order: { created_at: 'ASC' },
    });
  }

  async desasignarDeObra(
    obraId: string,
    contratistaId: string,
    tenantId: string,
  ): Promise<void> {
    await this.findTenantObra(obraId, tenantId);
    const asignacion = await this.obraContratistaRepo.findOne({
      where: { obra_id: obraId, contratista_id: contratistaId },
    });
    if (!asignacion) throw new NotFoundException('Asignación no encontrada');
    await this.obraContratistaRepo.remove(asignacion);
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }
}
