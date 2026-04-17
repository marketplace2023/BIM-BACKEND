import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { BimPresupuesto } from '../database/entities/bim/bim-presupuesto.entity';
import { ReportesModule } from '../reportes/reportes.module';
import { PresupuestosModule } from '../presupuestos/presupuestos.module';
import { ObrasService } from './obras.service';
import { ObrasController } from './obras.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BimObra, BimPresupuesto]), BimAdminModule, ReportesModule, PresupuestosModule],
  controllers: [ObrasController],
  providers: [ObrasService],
  exports: [ObrasService],
})
export class ObrasModule {}
