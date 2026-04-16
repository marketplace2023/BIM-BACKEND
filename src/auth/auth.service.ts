import {
  ConflictException,
  Injectable,
  BadRequestException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { Tenant } from '../database/entities/core/tenant.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { UserRole } from '../database/entities/identity/user-role.entity';
import { UserRoleAssignment } from '../database/entities/identity/user-role-assignment.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { PasswordResetMailerService } from './password-reset-mailer.service';
import {
  ENTITY_TYPES,
  mapFurStatusToLegacy,
  type MarketplaceEntityType,
  type MarketplaceRole,
} from '../common/constants/marketplace.constants';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Tenant) private tenantsRepo: Repository<Tenant>,
    @InjectRepository(ResUser) private usersRepo: Repository<ResUser>,
    @InjectRepository(ResPartner) private partnersRepo: Repository<ResPartner>,
    @InjectRepository(UserRole) private rolesRepo: Repository<UserRole>,
    @InjectRepository(UserRoleAssignment)
    private roleAssignmentsRepo: Repository<UserRoleAssignment>,
    private jwtService: JwtService,
    private passwordResetMailer: PasswordResetMailerService,
  ) {}

  async onModuleInit() {
    await this.ensureBaseRoles();
    await this.ensureAdminUser();
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const tenantId = await this.resolveTenantIdForRegistration(
      dto.tenant_id,
      dto.username,
      dto.name,
    );
    const role = this.resolvePrimaryRole(dto.role);
    const entityType = this.resolveRegistrationEntityType(
      dto.role,
      dto.entity_type,
    );
    const userStatus = role === 'consumer' ? 'published' : 'draft';
    const storeStatus = role === 'consumer' ? 'published' : 'draft';

    const partner = await this.partnersRepo.save(
      this.partnersRepo.create({
        tenant_id: tenantId,
        entity_type: entityType,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        city: dto.city ?? null,
        country: dto.country ?? null,
        x_partner_role: role,
        x_verification_status: mapFurStatusToLegacy(storeStatus),
        attributes_json: {
          fur_t: {
            status: storeStatus,
            role,
            vertical: entityType,
            created_at: new Date().toISOString(),
            compliance: {
              review_required: role === 'store',
              review_state: role === 'store' ? 'pending' : 'approved',
            },
          },
          fur_gbp: {
            status: 'draft',
            linked: false,
          },
        },
      }),
    );

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        tenant_id: tenantId,
        partner_id: partner.id,
        username: dto.username,
        email: dto.email,
        password_hash: await bcrypt.hash(dto.password, 12),
        kyc_status: mapFurStatusToLegacy(userStatus),
        security_json: {
          fur_u: {
            status: userStatus,
            role,
            audit: {
              created_at: new Date().toISOString(),
            },
          },
        },
      }),
    );

    await this.assignRoleToUser(user.id, partner.id, role);
    return this._buildToken(user, partner, [role]);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email },
      relations: ['partner'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.is_active) throw new UnauthorizedException('Account inactive');

    const roles = await this.getUserRoles(user.id);
    return this._buildToken(user, user.partner, roles);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user) {
      return {
        success: true,
        message:
          'Si el correo existe, te enviaremos instrucciones para restablecer la contrasena.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    const currentSecurity = user.security_json ?? {};

    user.security_json = {
      ...currentSecurity,
      password_reset: {
        token_hash: tokenHash,
        expires_at: expiresAt,
        requested_at: new Date().toISOString(),
      },
    };

    await this.usersRepo.save(user);

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:5173');
    const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    await this.passwordResetMailer.sendResetLink(user.email, resetUrl);

    return {
      success: true,
      message:
        'Si el correo existe, te enviaremos instrucciones para restablecer la contrasena.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const users = await this.usersRepo.find();
    const user = users.find((candidate) => {
      const resetData = candidate.security_json?.password_reset;
      return resetData?.token_hash === tokenHash;
    });

    if (!user) {
      throw new BadRequestException('El enlace de recuperacion no es valido o ya expiro.');
    }

    const resetData = user.security_json?.password_reset;
    if (!resetData?.expires_at || new Date(resetData.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('El enlace de recuperacion no es valido o ya expiro.');
    }

    user.password_hash = await bcrypt.hash(dto.password, 12);
    user.security_json = {
      ...(user.security_json ?? {}),
      password_reset: null,
    };
    await this.usersRepo.save(user);

    return { success: true, message: 'Contrasena actualizada correctamente.' };
  }

  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['partner'],
    });

    if (!user) return null;

    return {
      ...user,
      role: this.resolvePrimaryRole(
        user.partner?.x_partner_role,
        await this.getUserRoles(user.id),
      ),
      roles: await this.getUserRoles(user.id),
    };
  }

  private resolveRegistrationEntityType(
    role: string,
    entityType?: string,
  ): MarketplaceEntityType {
    if (role === 'consumer') {
      return 'customer';
    }

    if (
      entityType &&
      ENTITY_TYPES.includes(entityType as MarketplaceEntityType)
    ) {
      return entityType as MarketplaceEntityType;
    }

    return 'customer';
  }

  private resolvePrimaryRole(
    preferred?: string | null,
    roles: string[] = [],
  ): MarketplaceRole {
    if (roles.includes('admin') || preferred === 'admin') return 'admin';
    if (roles.includes('store') || preferred === 'store') return 'store';
    return 'consumer';
  }

  private async getUserRoles(userId: string) {
    const assignments = await this.roleAssignmentsRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    return assignments
      .map((assignment) => assignment.role?.code)
      .filter((code): code is string => Boolean(code));
  }

  private async resolveTenantId(preferredTenantId?: string) {
    if (preferredTenantId) {
      const preferred = await this.tenantsRepo.findOne({
        where: { id: preferredTenantId },
      });
      if (preferred) return preferred.id;
    }

    const existingDefault = await this.tenantsRepo.findOne({
      where: { slug: 'marketplace-master' },
    });
    if (existingDefault) return existingDefault.id;

    const firstTenant = await this.tenantsRepo.find({
      order: { id: 'ASC' },
      take: 1,
    });
    if (firstTenant.length > 0) return firstTenant[0].id;

    const tenant = await this.tenantsRepo.save(
      this.tenantsRepo.create({
        name: 'Marketplace Master',
        slug: 'marketplace-master',
        status: 'active',
      }),
    );

    return tenant.id;
  }

  private async resolveTenantIdForRegistration(
    preferredTenantId: string | undefined,
    username: string,
    name: string,
  ) {
    if (preferredTenantId) {
      return this.resolveTenantId(preferredTenantId);
    }

    const baseSlug = this.buildTenantSlug(username || name || 'tenant');
    let slug = baseSlug;
    let suffix = 1;

    while (await this.tenantsRepo.findOne({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const tenant = await this.tenantsRepo.save(
      this.tenantsRepo.create({
        name: `${name} Workspace`,
        slug,
        status: 'active',
      }),
    );

    return tenant.id;
  }

  private buildTenantSlug(input: string) {
    const normalized = input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);

    return normalized || `tenant-${Date.now()}`;
  }

  private async ensureAdminUser() {
    const tenantId = await this.resolveTenantId();
    const adminRole = await this.ensureAdminRole();
    const adminEmail = this.configService.get<string>(
      'BIM_ADMIN_EMAIL',
      'admin@bim.local',
    );
    const adminPassword = this.configService.get<string>(
      'BIM_ADMIN_PASS',
      'Admin1234!',
    );
    const adminUsername = this.configService.get<string>(
      'ADMIN_USERNAME',
      'admin',
    );
    const adminName = this.configService.get<string>('ADMIN_NAME', 'BIM Admin');

    // Look up by configured email first, then fall back to username (handles
    // the case where a previous boot seeded the user with a different email).
    let user =
      (await this.usersRepo.findOne({ where: { email: adminEmail } })) ??
      (await this.usersRepo.findOne({ where: { username: adminUsername } }));

    if (!user) {
      const partner = await this.partnersRepo.save(
        this.partnersRepo.create({
          tenant_id: tenantId,
          entity_type: 'customer',
          name: adminName,
          email: adminEmail,
          x_partner_role: 'admin',
          x_verification_status: 'published',
          attributes_json: {
            fur_t: {
              status: 'published',
              role: 'admin',
            },
          },
        }),
      );

      user = await this.usersRepo.save(
        this.usersRepo.create({
          tenant_id: tenantId,
          partner_id: partner.id,
          username: adminUsername,
          email: adminEmail,
          password_hash: await bcrypt.hash(adminPassword, 12),
          is_active: 1,
          is_email_verified: 1,
          kyc_status: 'published',
          security_json: {
            fur_u: {
              status: 'published',
              role: 'admin',
            },
          },
        }),
      );
    } else {
      // Update email and password to match current .env values.
      await this.usersRepo.update(user.id, {
        email: adminEmail,
        password_hash: await bcrypt.hash(adminPassword, 12),
        is_active: 1,
      });
      user.email = adminEmail;
    }

    const existingAssignment = await this.roleAssignmentsRepo.findOne({
      where: {
        user_id: user.id,
        role_id: adminRole.id,
        partner_id: user.partner_id,
      },
    });

    if (!existingAssignment) {
      await this.roleAssignmentsRepo.save(
        this.roleAssignmentsRepo.create({
          user_id: user.id,
          role_id: adminRole.id,
          partner_id: user.partner_id,
        }),
      );
    }
  }

  private async ensureAdminRole() {
    const existingRole = await this.rolesRepo.findOne({
      where: { code: 'admin' },
    });
    if (existingRole) return existingRole;

    return this.rolesRepo.save(
      this.rolesRepo.create({
        code: 'admin',
        name: 'Administrator',
      }),
    );
  }

  private async ensureBaseRoles() {
    const existingRoles = await this.rolesRepo.find();
    const existingCodes = new Set(existingRoles.map((role) => role.code));

    for (const [code, name] of [
      ['consumer', 'Consumer'],
      ['store', 'Store'],
      ['admin', 'Administrator'],
    ] as const) {
      if (!existingCodes.has(code)) {
        await this.rolesRepo.save(this.rolesRepo.create({ code, name }));
      }
    }
  }

  private async assignRoleToUser(
    userId: string,
    partnerId: string,
    roleCode: MarketplaceRole,
  ) {
    const role = await this.rolesRepo.findOne({ where: { code: roleCode } });
    if (!role) {
      throw new ConflictException(`Role ${roleCode} is not configured`);
    }

    const existing = await this.roleAssignmentsRepo.findOne({
      where: { user_id: userId, role_id: role.id, partner_id: partnerId },
    });

    if (!existing) {
      await this.roleAssignmentsRepo.save(
        this.roleAssignmentsRepo.create({
          user_id: userId,
          role_id: role.id,
          partner_id: partnerId,
        }),
      );
    }
  }

  private _buildToken(user: ResUser, partner: ResPartner, roles: string[]) {
    const role = this.resolvePrimaryRole(partner.x_partner_role, roles);
    const payload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      partner_id: partner.id,
      role,
      roles,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        tenant_id: user.tenant_id,
        partner_id: partner.id,
        role,
        roles,
        entity_type: partner.entity_type,
      },
    };
  }
}
