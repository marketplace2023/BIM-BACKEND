import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CertificacionesService } from './certificaciones.service';
import { CertificacionesController } from './certificaciones.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimCertificacion,
      BimLineaCertificacion,
      BimMedicion,
      BimMedicionDocumento,
      BimObra,
      BimCapitulo,
      BimPartida,
      BimPresupuesto,
    ]),
    BimAdminModule,
  ],
  controllers: [CertificacionesController],
  providers: [CertificacionesService],
  exports: [CertificacionesService],
})
export class CertificacionesModule {}
