import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { ReconsideracionesController } from './reconsideraciones.controller';
import { ReconsideracionesService } from './reconsideraciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([BimReconsideracion, BimObra, BimPartida]), BimAdminModule],
  controllers: [ReconsideracionesController],
  providers: [ReconsideracionesService],
  exports: [ReconsideracionesService],
})
export class ReconsideracionesModule {}
