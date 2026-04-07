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
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    user.last_login_at = new Date();
    await this.userRepo.save(user);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload, {
      secret: this.config.get<string>('BIM_JWT_SECRET', 'bim-secret-change-me'),
      expiresIn: '8h',
    });

    const { password_hash: _, ...safeUser } = user;
    return { access_token, user: safeUser };
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
}
