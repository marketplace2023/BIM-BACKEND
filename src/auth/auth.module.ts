import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { Tenant } from '../database/entities/core/tenant.entity';
import { UserRole } from '../database/entities/identity/user-role.entity';
import { UserRoleAssignment } from '../database/entities/identity/user-role-assignment.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'changeme'),
        signOptions: {
          expiresIn: (cfg.get<string>('JWT_EXPIRES') ?? '7d') as any,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      ResUser,
      ResPartner,
      Tenant,
      UserRole,
      UserRoleAssignment,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
