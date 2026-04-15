import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BimComputo } from '../database/entities/bim/bim-computo.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CreateComputoDto } from './dto/create-computo.dto';
import { UpdateComputoDto } from './dto/update-computo.dto';

@Injectable()
export class ComputosService {
  constructor(
    @InjectRepository(BimComputo)
    private readonly computoRepo: Repository<BimComputo>,
    @InjectRepository(BimObra)
    private readonly obraRepo: Repository<BimObra>,
    @InjectRepository(BimPartida)
    private readonly partidaRepo: Repository<BimPartida>,
  ) {}

  async create(dto: CreateComputoDto, userId: string, tenantId: string) {
    const obra = await this.findTenantObra(dto.obra_id, tenantId);
    const partida = await this.findTenantPartida(dto.partida_id, tenantId);

    if (partida.obra_id !== obra.id) {
      throw new BadRequestException(
        'La partida no pertenece a la obra seleccionada',
      );
    }

    const computo = this.computoRepo.create({
      tenant_id: tenantId,
      obra_id: dto.obra_id,
      partida_id: dto.partida_id,
      descripcion: dto.descripcion,
      formula_tipo: dto.formula_tipo,
      cantidad: dto.cantidad ?? '0',
      largo: dto.largo ?? '0',
      ancho: dto.ancho ?? '0',
      alto: dto.alto ?? '0',
      resultado: '0',
      notas: dto.notas ?? null,
      created_by: userId,
    });

    computo.resultado = this.calculateResult(computo).toFixed(4);
    return this.computoRepo.save(computo);
  }

  async findByObra(obraId: string, tenantId: string) {
    await this.findTenantObra(obraId, tenantId);
    return this.computoRepo.find({
      where: { obra_id: obraId, tenant_id: tenantId },
      relations: ['partida', 'creador'],
      order: { created_at: 'DESC' },
    });
  }

  async findByPartida(partidaId: string, tenantId: string) {
    await this.findTenantPartida(partidaId, tenantId);
    return this.computoRepo.find({
      where: { partida_id: partidaId, tenant_id: tenantId },
      relations: ['creador'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const computo = await this.computoRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['partida', 'obra', 'creador'],
    });

    if (!computo) throw new NotFoundException(`Cómputo #${id} no encontrado`);
    return computo;
  }

  async update(id: string, tenantId: string, dto: UpdateComputoDto) {
    const computo = await this.findOne(id, tenantId);

    if (dto.obra_id && dto.obra_id !== computo.obra_id) {
      await this.findTenantObra(dto.obra_id, tenantId);
      computo.obra_id = dto.obra_id;
    }

    if (dto.partida_id && dto.partida_id !== computo.partida_id) {
      const partida = await this.findTenantPartida(dto.partida_id, tenantId);
      if (dto.obra_id && partida.obra_id !== dto.obra_id) {
        throw new BadRequestException(
          'La partida no pertenece a la obra seleccionada',
        );
      }
      if (!dto.obra_id && partida.obra_id !== computo.obra_id) {
        throw new BadRequestException(
          'La partida no pertenece a la obra actual',
        );
      }
      computo.partida_id = dto.partida_id;
    }

    if (dto.descripcion !== undefined) computo.descripcion = dto.descripcion;
    if (dto.formula_tipo !== undefined) computo.formula_tipo = dto.formula_tipo;
    if (dto.cantidad !== undefined) computo.cantidad = dto.cantidad;
    if (dto.largo !== undefined) computo.largo = dto.largo;
    if (dto.ancho !== undefined) computo.ancho = dto.ancho;
    if (dto.alto !== undefined) computo.alto = dto.alto;
    if (dto.notas !== undefined) computo.notas = dto.notas ?? null;

    computo.resultado = this.calculateResult(computo).toFixed(4);
    return this.computoRepo.save(computo);
  }

  async remove(id: string, tenantId: string) {
    const computo = await this.findOne(id, tenantId);
    await this.computoRepo.remove(computo);
  }

  private calculateResult(
    input: Pick<
      BimComputo,
      'formula_tipo' | 'cantidad' | 'largo' | 'ancho' | 'alto'
    >,
  ) {
    const cantidad = Number.parseFloat(input.cantidad ?? '0') || 0;
    const largo = Number.parseFloat(input.largo ?? '0') || 0;
    const ancho = Number.parseFloat(input.ancho ?? '0') || 0;
    const alto = Number.parseFloat(input.alto ?? '0') || 0;

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

  private async findTenantPartida(id: string, tenantId: string) {
    const partida = await this.partidaRepo
      .createQueryBuilder('partida')
      .innerJoin(BimCapitulo, 'capitulo', 'capitulo.id = partida.capitulo_id')
      .innerJoin(
        BimPresupuesto,
        'presupuesto',
        'presupuesto.id = capitulo.presupuesto_id',
      )
      .innerJoin(BimObra, 'obra', 'obra.id = presupuesto.obra_id')
      .where('partida.id = :id', { id })
      .andWhere('presupuesto.tenant_id = :tenantId', { tenantId })
      .select([
        'partida.id AS id',
        'partida.cantidad AS cantidad',
        'obra.id AS obra_id',
      ])
      .getRawOne<{ id: string; cantidad: string; obra_id: string }>();

    if (!partida) throw new NotFoundException(`Partida #${id} no encontrada`);
    return partida;
  }
}
