import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimPartidaMaterial } from '../database/entities/bim/bim-partida-material.entity';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimApuDescomposicion } from '../database/entities/bim/bim-apu-descomposicion.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimPrecioUnitario } from '../database/entities/bim/bim-precio-unitario.entity';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import { BimPresupuestoModificadoFuente } from '../database/entities/bim/bim-presupuesto-modificado-fuente.entity';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestosController } from './presupuestos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimPresupuesto,
      BimCapitulo,
      BimPartida,
      BimPartidaMaterial,
      BimApuDescomposicion,
      BimCertificacion,
      BimLineaCertificacion,
      BimMedicion,
      BimMedicionDocumento,
      BimPrecioUnitario,
      BimReconsideracion,
      BimReconsideracionDocumento,
      BimPresupuestoModificadoFuente,
      BimRecurso,
      BimObra,
    ]),
    BimAdminModule,
  ],
  controllers: [PresupuestosController],
  providers: [PresupuestosService],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
