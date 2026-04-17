import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// ── Marketplace (reutilizados) ───────────────────────────────
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StoresModule } from './stores/stores.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { IntentsModule } from './intents/intents.module';

// ── BIM (módulos nuevos) ─────────────────────────────────────
import { ObrasModule } from './obras/obras.module';
import { ContratistasModule } from './contratistas/contratistas.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { PreciosUnitariosModule } from './precios-unitarios/precios-unitarios.module';
import { CertificacionesModule } from './certificaciones/certificaciones.module';
import { MedicionesModule } from './mediciones/mediciones.module';
import { ComputosModule } from './computos/computos.module';
import { MemoriasModule } from './memorias/memorias.module';
import { ReconsideracionesModule } from './reconsideraciones/reconsideraciones.module';
import { ReportesModule } from './reportes/reportes.module';
import { BimAdminModule } from './bim-admin/bim-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 3306),
        username: cfg.get<string>('DB_USER', 'root'),
        password: cfg.get<string>('DB_PASS', ''),
        database: cfg.get<string>('DB_NAME', 'bim_platform'),
        charset: 'utf8mb4',
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),

    // Marketplace
    AuthModule,
    UsersModule,
    StoresModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    IntentsModule,

    // BIM
    ObrasModule,
    ContratistasModule,
    PresupuestosModule,
    PreciosUnitariosModule,
    ComputosModule,
    MemoriasModule,
    MedicionesModule,
    ReconsideracionesModule,
    CertificacionesModule,
    ReportesModule,
    BimAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
