import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { MedicionesController } from './mediciones.controller';
import { MedicionesService } from './mediciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BimMedicion, BimObra, BimPartida]),
    BimAdminModule,
  ],
  controllers: [MedicionesController],
  providers: [MedicionesService],
  exports: [MedicionesService],
})
export class MedicionesModule {}
