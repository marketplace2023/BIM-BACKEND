import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimMemoriaDescriptiva } from '../database/entities/bim/bim-memoria-descriptiva.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { MemoriasController } from './memorias.controller';
import { MemoriasService } from './memorias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimMemoriaDescriptiva,
      BimObra,
      BimPresupuesto,
      BimPartida,
    ]),
    BimAdminModule,
  ],
  controllers: [MemoriasController],
  providers: [MemoriasService],
  exports: [MemoriasService],
})
export class MemoriasModule {}
