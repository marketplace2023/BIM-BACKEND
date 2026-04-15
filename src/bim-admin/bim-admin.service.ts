import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BimUser } from '../database/entities/bim/bim-user.entity';
import { Tenant } from '../database/entities/core/tenant.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { UserRoleAssignment } from '../database/entities/identity/user-role-assignment.entity';
import {
  CreateBimUserDto,
  UpdateBimUserDto,
  BimLoginDto,
} from './dto/bim-user.dto';

@Injectable()
export class BimAdminService implements OnModuleInit {
  constructor(
    @InjectRepository(BimUser)
    private readonly userRepo: Repository<BimUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(ResUser)
    private readonly resUserRepo: Repository<ResUser>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignmentRepo: Repository<UserRoleAssignment>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Crea el admin por defecto si no existe
  async onModuleInit(): Promise<void> {
    const adminEmail = this.config.get<string>(
      'BIM_ADMIN_EMAIL',
      'admin@bim.local',
    );
    const exists = await this.userRepo.findOneBy({ email: adminEmail });
    if (!exists) {
      const hash = await bcrypt.hash(
        this.config.get<string>('BIM_ADMIN_PASS', 'Admin1234!'),
        10,
      );
      await this.userRepo.save(
        this.userRepo.create({
          email: adminEmail,
          username: 'admin',
          password_hash: hash,
          full_name: 'Administrador BIM',
          role: 'admin',
        }),
      );
    }
  }

  async login(
    dto: BimLoginDto,
  ): Promise<{ access_token: string; user: Partial<BimUser> }> {
    const user = await this.userRepo.findOneBy({
      email: dto.email,
      is_active: 1,
    });

    if (user) {
      const valid = await bcrypt.compare(dto.password, user.password_hash);
      if (!valid) throw new UnauthorizedException('Credenciales inválidas');

      user.last_login_at = new Date();
      await this.userRepo.save(user);

      const tenantId = await this.resolveTenantId();
      const platformUserId = await this.resolvePlatformUserId(tenantId);
      const partnerId = await this.resolveMarketplacePartnerId(
        platformUserId,
        tenantId,
      );
      const payload = {
        sub: user.id,
        id: user.id,
        email: user.email,
        role: user.role,
        roles: [user.role],
        tenant_id: tenantId,
        platform_user_id: platformUserId,
        partner_id: partnerId,
        auth_scope: 'bim',
      };
      const access_token = this.jwtService.sign(payload, {
        secret: this.config.get<string>(
          'BIM_JWT_SECRET',
          'bim-secret-change-me',
        ),
        expiresIn: '8h',
      });

      const { password_hash: _, ...safeUser } = user;
      return { access_token, user: safeUser };
    }

    return this.loginMarketplaceUser(dto);
  }

  async findCurrentUser(userId: string): Promise<Record<string, any>> {
    const bimUser = await this.userRepo.findOne({
      where: { id: userId, deleted_at: IsNull() },
    });
    if (bimUser) {
      const { password_hash: _, ...safe } = bimUser;
      return safe;
    }

    const user = await this.resUserRepo.findOne({
      where: { id: userId, is_active: 1 },
      relations: ['partner'],
    });
    if (!user) {
      throw new NotFoundException(`Usuario #${userId} no encontrado`);
    }

    const assignments = await this.roleAssignmentRepo.find({
      where: { user_id: user.id },
      relations: ['role'],
    });
    const roles = assignments
      .map((assignment) => assignment.role?.code)
      .filter((code): code is string => Boolean(code));

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.partner?.name ?? user.username,
      role: roles.includes('admin') ? 'admin' : 'consulta',
      roles,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async createUser(dto: CreateBimUserDto): Promise<BimUser> {
    const exists = await this.userRepo.findOneBy([
      { email: dto.email },
      { username: dto.username },
    ]);
    if (exists) {
      throw new ConflictException('El email o username ya está en uso');
    }
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      username: dto.username,
      password_hash: hash,
      full_name: dto.full_name,
      role: dto.role ?? 'consulta',
    });
    return this.userRepo.save(user);
  }

  async findUsers(): Promise<Partial<BimUser>[]> {
    const users = await this.userRepo.find({
      where: { deleted_at: IsNull() },
      order: { full_name: 'ASC' },
    });
    return users.map(({ password_hash: _, ...u }) => u);
  }

  async findUser(id: string): Promise<Partial<BimUser>> {
    const user = await this.userRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!user) throw new NotFoundException(`Usuario #${id} no encontrado`);
    const { password_hash: _, ...safe } = user;
    return safe;
  }

  async updateUser(
    id: string,
    dto: UpdateBimUserDto,
  ): Promise<Partial<BimUser>> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`Usuario #${id} no encontrado`);

    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.role) user.role = dto.role;
    if (dto.is_active !== undefined) user.is_active = dto.is_active;

    const saved = await this.userRepo.save(user);
    const { password_hash: _, ...safe } = saved;
    return safe;
  }

  async removeUser(id: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`Usuario #${id} no encontrado`);
    await this.userRepo.softRemove(user);
  }

  private async loginMarketplaceUser(
    dto: BimLoginDto,
  ): Promise<{ access_token: string; user: Partial<BimUser> }> {
    const user = await this.resUserRepo.findOne({
      where: { email: dto.email, is_active: 1 },
      relations: ['partner'],
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const assignments = await this.roleAssignmentRepo.find({
      where: { user_id: user.id },
      relations: ['role'],
    });
    const roles = assignments
      .map((assignment) => assignment.role?.code)
      .filter((code): code is string => Boolean(code));
    const role = roles.includes('admin') ? 'admin' : 'consulta';

    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role,
      roles,
      tenant_id: user.tenant_id,
      platform_user_id: user.id,
      partner_id: user.partner_id,
      auth_scope: 'bim',
    };
    const access_token = this.jwtService.sign(payload, {
      secret: this.config.get<string>('BIM_JWT_SECRET', 'bim-secret-change-me'),
      expiresIn: '8h',
    });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.partner?.name ?? user.username,
        role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  private async resolveTenantId(): Promise<string> {
    const configuredTenantId = this.config.get<string>('BIM_DEFAULT_TENANT_ID');
    if (configuredTenantId) {
      return configuredTenantId;
    }

    const masterTenant = await this.tenantRepo.findOne({
      where: { slug: 'marketplace-master' },
    });
    if (masterTenant) {
      return masterTenant.id;
    }

    const fallbackTenant = await this.tenantRepo.find({
      order: { id: 'ASC' },
      take: 1,
    });
    if (fallbackTenant[0]) {
      return fallbackTenant[0].id;
    }

    throw new UnauthorizedException(
      'No existe un tenant disponible para operar el panel BIM',
    );
  }

  private async resolvePlatformUserId(tenantId: string): Promise<string> {
    const configuredUserId = this.config.get<string>(
      'BIM_DEFAULT_PLATFORM_USER_ID',
    );
    if (configuredUserId) {
      return configuredUserId;
    }

    const users = await this.resUserRepo.find({
      where: { tenant_id: tenantId, is_active: 1 },
      order: { id: 'ASC' },
      take: 1,
    });
    if (users[0]) {
      return users[0].id;
    }

    throw new UnauthorizedException(
      'No existe un usuario operativo asociado al tenant BIM',
    );
  }

  private async resolveMarketplacePartnerId(
    platformUserId: string,
    tenantId: string,
  ): Promise<string> {
    const configuredPartnerId = this.config.get<string>(
      'BIM_DEFAULT_PARTNER_ID',
    );
    if (configuredPartnerId) {
      return configuredPartnerId;
    }

    const platformUser = await this.resUserRepo.findOne({
      where: { id: platformUserId, tenant_id: tenantId, is_active: 1 },
    });
    if (platformUser?.partner_id) {
      return platformUser.partner_id;
    }

    throw new UnauthorizedException(
      'No existe un partner comercial asociado al usuario BIM actual',
    );
  }
}
