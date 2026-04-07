import { Module } from '@nestjs/common';
import { GbpService } from './gbp.service';
import { GbpController } from './gbp.controller';
import { GbpDevController } from './gbp-dev.controller';

@Module({
  controllers: [GbpController, GbpDevController],
  providers: [GbpService],
  exports: [GbpService],
})
export class GbpModule {}
