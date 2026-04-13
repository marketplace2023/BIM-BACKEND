import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimAdminModule } from '../bim-admin/bim-admin.module';
import { Tenant } from '../database/entities/core/tenant.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ContractorProfile } from '../database/entities/verticals/contractor-profile.entity';
import { EducationProviderProfile } from '../database/entities/verticals/education-provider-profile.entity';
import { HardwareStoreProfile } from '../database/entities/verticals/hardware-store-profile.entity';
import { ProfessionalFirmProfile } from '../database/entities/verticals/professional-firm-profile.entity';
import { SeoAgencyProfile } from '../database/entities/verticals/seo-agency-profile.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { StorePaymentMethodsModule } from '../store-payment-methods/store-payment-methods.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [
    BimAdminModule,
    StorePaymentMethodsModule,
    TypeOrmModule.forFeature([
      ResPartner,
      ContractorProfile,
      EducationProviderProfile,
      HardwareStoreProfile,
      ProfessionalFirmProfile,
      SeoAgencyProfile,
      ProductTemplate,
      Tenant,
    ]),
  ],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
