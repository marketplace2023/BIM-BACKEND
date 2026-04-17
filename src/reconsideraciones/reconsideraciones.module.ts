import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { ReconsideracionesController } from './reconsideraciones.controller';
import { ReconsideracionesService } from './reconsideraciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimReconsideracion,
      BimReconsideracionDocumento,
      BimCertificacion,
      BimLineaCertificacion,
      BimObra,
      BimCapitulo,
      BimPartida,
      BimPresupuesto,
    ]),
    BimAdminModule,
  ],
  controllers: [ReconsideracionesController],
  providers: [ReconsideracionesService],
  exports: [ReconsideracionesService],
})
export class ReconsideracionesModule {}
