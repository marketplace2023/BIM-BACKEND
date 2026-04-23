import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { BimCapitulo } from '../database/entities/bim/bim-capitulo.entity';
import { BimPartida } from '../database/entities/bim/bim-partida.entity';
import { BimComputo } from '../database/entities/bim/bim-computo.entity';
import { BimMedicion } from '../database/entities/bim/bim-medicion.entity';
import { BimMedicionDocumento } from '../database/entities/bim/bim-medicion-documento.entity';
import { BimCertificacion } from '../database/entities/bim/bim-certificacion.entity';
import { BimLineaCertificacion } from '../database/entities/bim/bim-linea-certificacion.entity';
import { BimReconsideracion } from '../database/entities/bim/bim-reconsideracion.entity';
import { BimReconsideracionDocumento } from '../database/entities/bim/bim-reconsideracion-documento.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import { BimPresupuestoModificadoFuente } from '../database/entities/bim/bim-presupuesto-modificado-fuente.entity';
import { ComputosModule } from '../computos/computos.module';
import { MemoriasModule } from '../memorias/memorias.module';
import { PresupuestosModule } from '../presupuestos/presupuestos.module';
import { ReconsideracionesModule } from '../reconsideraciones/reconsideraciones.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimObra,
      BimPresupuesto,
      BimCapitulo,
      BimPartida,
      BimComputo,
      BimMedicion,
      BimMedicionDocumento,
      BimCertificacion,
      BimLineaCertificacion,
      BimReconsideracion,
      BimReconsideracionDocumento,
      BimPresupuestoModificadoFuente,
      BimRecurso,
    ]),
    BimAdminModule,
    ComputosModule,
    MemoriasModule,
    PresupuestosModule,
    ReconsideracionesModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
