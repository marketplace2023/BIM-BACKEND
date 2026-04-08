import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestosController } from './presupuestos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BimPresupuesto, BimCapitulo, BimPartida, BimObra]),
  ],
  controllers: [PresupuestosController],
  providers: [PresupuestosService],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
