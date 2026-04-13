import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { BimObra } from '../database/entities/bim/bim-obra.entity';
import { ObrasService } from './obras.service';
import { ObrasController } from './obras.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BimObra]), BimAdminModule],
  controllers: [ObrasController],
  providers: [ObrasService],
  exports: [ObrasService],
})
export class ObrasModule {}
