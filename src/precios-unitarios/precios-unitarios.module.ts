import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimPrecioUnitario } from '../database/entities/bim/bim-precio-unitario.entity';
import { BimRecurso } from '../database/entities/bim/bim-recurso.entity';
import { BimApuDescomposicion } from '../database/entities/bim/bim-apu-descomposicion.entity';
import { PreciosUnitariosService } from './precios-unitarios.service';
import { PreciosUnitariosController } from './precios-unitarios.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BimPrecioUnitario,
      BimRecurso,
      BimApuDescomposicion,
    ]),
    BimAdminModule,
  ],
  controllers: [PreciosUnitariosController],
  providers: [PreciosUnitariosService],
  exports: [PreciosUnitariosService],
})
export class PreciosUnitariosModule {}
