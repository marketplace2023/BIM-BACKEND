import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimContratista } from '../database/entities/bim/bim-contratista.entity';
import { BimObraContratista } from '../database/entities/bim/bim-obra-contratista.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { ContratistasService } from './contratistas.service';
import { ContratistasController } from './contratistas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BimContratista, BimObraContratista, BimObra]),
    BimAdminModule,
  ],
  controllers: [ContratistasController],
  providers: [ContratistasService],
  exports: [ContratistasService],
})
export class ContratistasModule {}
