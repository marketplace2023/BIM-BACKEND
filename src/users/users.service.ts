import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(ResUser) private usersRepo: Repository<ResUser>,
    @InjectRepository(ResPartner) private partnersRepo: Repository<ResPartner>,
  ) {}

  async findMe(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['partner'],
    });
    if (!user) throw new NotFoundException('User not found');
    const { password_hash, security_json, ...safe } = user as any;
    return safe;
  }

  async updateMe(userId: string, partnerId: string, dto: UpdateUserDto) {
    if (dto.username || dto.email) {
      await this.usersRepo.update(userId, {
        ...(dto.username && { username: dto.username }),
        ...(dto.email && { email: dto.email }),
      });
    }

    const partnerUpdate: Record<string, any> = {};
    [
      'name',
      'phone',
      'city',
      'country',
      'street',
      'logo_url',
      'description',
    ].forEach((k) => {
      if ((dto as any)[k] !== undefined) partnerUpdate[k] = (dto as any)[k];
    });
    if (Object.keys(partnerUpdate).length) {
      await this.partnersRepo.update(partnerId, partnerUpdate);
    }

    return this.findMe(userId);
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(
      dto.current_password,
      user.password_hash,
    );
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.new_password, 12);
    await this.usersRepo.update(userId, { password_hash: newHash });
    return { message: 'Password updated successfully' };
  }
}
