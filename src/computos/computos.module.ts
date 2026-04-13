import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimComputo } from '../database/entities/bim/bim-computo.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { ComputosController } from './computos.controller';
import { ComputosService } from './computos.service';

@Module({
  imports: [TypeOrmModule.forFeature([BimComputo, BimObra, BimPartida]), BimAdminModule],
  controllers: [ComputosController],
  providers: [ComputosService],
  exports: [ComputosService],
})
export class ComputosModule {}
