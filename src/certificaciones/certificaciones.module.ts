import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { CertificacionesService } from './certificaciones.service';
import { CertificacionesController } from './certificaciones.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimCertificacion,
      BimLineaCertificacion,
      BimObra,
      BimPresupuesto,
    ]),
  ],
  controllers: [CertificacionesController],
  providers: [CertificacionesService],
  exports: [CertificacionesService],
})
export class CertificacionesModule {}
