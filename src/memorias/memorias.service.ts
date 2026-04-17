import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BimMemoriaDescriptiva } from '../database/entities/bim/bim-memoria-descriptiva.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateMemoriaDto } from './dto/create-memoria.dto';
import { ChangeDocumentStatusDto } from '../common/dto/change-document-status.dto';
import { UpdateMemoriaDto } from './dto/update-memoria.dto';

@Injectable()
export class MemoriasService {
  constructor(
    @InjectRepository(BimMemoriaDescriptiva)
    private readonly memoriaRepo: Repository<BimMemoriaDescriptiva>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPresupuesto)
    private readonly presupuestoRepo: Repository<BimPresupuesto>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
  ) {}

  async findByObra(obraId: string, tenantId: string, presupuestoId?: string) {
    await this.findTenantObra(obraId, tenantId)

    const where: { obra_id: string; tenant_id: string; presupuesto_id?: string } = {
      obra_id: obraId,
      tenant_id: tenantId,
    }

    if (presupuestoId) where.presupuesto_id = presupuestoId

    return this.memoriaRepo.find({
      where,
      relations: ['presupuesto', 'partida', 'creador'],
      order: { updated_at: 'DESC', id: 'DESC' },
    })
  }

  async create(dto: CreateMemoriaDto, userId: string, tenantId: string) {
    const obra = await this.findTenantObra(dto.obra_id, tenantId)
    const presupuesto = await this.findTenantPresupuesto(dto.presupuesto_id, tenantId)

    if (String(presupuesto.obra_id) !== String(obra.id)) {
      throw new BadRequestException('El presupuesto no pertenece a la obra seleccionada')
    }

    let partidaId: string | null = null
    if (dto.partida_id) {
      const partida = await this.findTenantPartida(dto.partida_id, tenantId)
      partidaId = partida.id
    }

    return this.memoriaRepo.save(
      this.memoriaRepo.create({
        tenant_id: tenantId,
        obra_id: obra.id,
        presupuesto_id: presupuesto.id,
        partida_id: partidaId,
        tipo: dto.tipo,
        titulo: dto.titulo.trim(),
        contenido: dto.contenido,
        status: 'borrador',
        created_by: userId,
      }),
    )
  }

  async findOne(id: string, tenantId: string) {
    const memoria = await this.memoriaRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['obra', 'presupuesto', 'partida', 'creador'],
    })

    if (!memoria) {
      throw new NotFoundException(`Memoria descriptiva #${id} no encontrada`)
    }

    return memoria
  }

  async update(id: string, tenantId: string, dto: UpdateMemoriaDto) {
    const memoria = await this.findOne(id, tenantId)

    if (memoria.status !== 'borrador') {
      throw new BadRequestException('Solo puedes editar memorias en borrador')
    }

    if (dto.obra_id && dto.obra_id !== memoria.obra_id) {
      const obra = await this.findTenantObra(dto.obra_id, tenantId)
      memoria.obra_id = obra.id
    }

    if (dto.presupuesto_id && dto.presupuesto_id !== memoria.presupuesto_id) {
      const presupuesto = await this.findTenantPresupuesto(dto.presupuesto_id, tenantId)
      if (String(presupuesto.obra_id) !== String(memoria.obra_id)) {
        throw new BadRequestException('El presupuesto no pertenece a la obra seleccionada')
      }
      memoria.presupuesto_id = presupuesto.id
    }

    if (dto.partida_id !== undefined) {
      if (!dto.partida_id) {
        memoria.partida_id = null
      } else {
        const partida = await this.findTenantPartida(dto.partida_id, tenantId)
        memoria.partida_id = partida.id
      }
    }

    if (dto.tipo) memoria.tipo = dto.tipo
    if (dto.titulo !== undefined) memoria.titulo = dto.titulo.trim()
    if (dto.contenido !== undefined) memoria.contenido = dto.contenido

    return this.memoriaRepo.save(memoria)
  }

  async remove(id: string, tenantId: string) {
    const memoria = await this.findOne(id, tenantId)

    if (memoria.status !== 'borrador') {
      throw new BadRequestException('Solo puedes eliminar memorias en borrador')
    }

    await this.memoriaRepo.remove(memoria)
  }

  async changeStatus(
    id: string,
    dto: ChangeDocumentStatusDto,
    _userId: string,
    tenantId: string,
  ) {
    const memoria = await this.findOne(id, tenantId)
    this.assertValidStatusTransition(memoria.status, dto.status)
    memoria.status = dto.status
    return this.memoriaRepo.save(memoria)
  }

  private async findTenantObra(id: string, tenantId: string) {
    const obra = await this.obraRepo.findOne({ where: { id, tenant_id: tenantId } })
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`)
    return obra
  }

  private async findTenantPresupuesto(id: string, tenantId: string) {
    const presupuesto = await this.presupuestoRepo.findOne({ where: { id, tenant_id: tenantId } })
    if (!presupuesto) throw new NotFoundException(`Presupuesto #${id} no encontrado`)
    return presupuesto
  }

  private async findTenantPartida(id: string, tenantId: string) {
    const partida = await this.partidaRepo
      .createQueryBuilder('partida')
      .innerJoin('bim_capitulos', 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin('bim_presupuestos', 'presupuesto', 'presupuesto.id = capitulo.presupuesto_id')
      .where('partida.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .getOne()

    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`)
    return partida
  }

  private assertValidStatusTransition(current: string, next: string) {
    if (current === next) return
    const allowed: Record<string, string[]> = {
      borrador: ['revisado'],
      revisado: ['borrador', 'aprobado'],
      aprobado: [],
    }
    if (!(allowed[current] ?? []).includes(next)) {
      throw new BadRequestException(`No se puede cambiar de ${current} a ${next}`)
    }
  }
}
