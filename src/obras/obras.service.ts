import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';

@Injectable()
export class ObrasService {
  constructor(
    @InjectRepository(BimObra)
    private readonly obrasRepo: Repository<BimObra>,
  ) {}

  async create(dto: CreateObraDto, userId: string): Promise<BimObra> {
    const exists = await this.obrasRepo.findOne({
      where: { codigo: dto.codigo },
    });
    if (exists) {
      throw new ConflictException(
        `Ya existe una obra con el código "${dto.codigo}"`,
      );
    }

    const obra = this.obrasRepo.create({
      ...dto,
      created_by: userId,
    });
    return this.obrasRepo.save(obra);
  }

  async findAll(estado?: string): Promise<BimObra[]> {
    const where: any = { deleted_at: IsNull() };
    if (estado) where.estado = estado;

    return this.obrasRepo.find({
      where,
      relations: ['responsable'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<BimObra> {
    const obra = await this.obrasRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['responsable', 'creator'],
    });
    if (!obra) throw new NotFoundException(`Obra #${id} no encontrada`);
    return obra;
  }

  async update(id: string, dto: UpdateObraDto): Promise<BimObra> {
    const obra = await this.findOne(id);

    if (dto.codigo && dto.codigo !== obra.codigo) {
      const duplicate = await this.obrasRepo.findOne({
        where: { codigo: dto.codigo },
      });
      if (duplicate) {
        throw new ConflictException(
          `Ya existe una obra con el código "${dto.codigo}"`,
        );
      }
    }

    Object.assign(obra, dto);
    return this.obrasRepo.save(obra);
  }

  async remove(id: string): Promise<void> {
    const obra = await this.findOne(id);
    await this.obrasRepo.softRemove(obra);
  }
}
