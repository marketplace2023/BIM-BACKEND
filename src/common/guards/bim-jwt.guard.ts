import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CanActivate } from '@nestjs/common';

@Injectable()
export class BimJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token BIM no proporcionado');
    }
    const token = header.slice(7);
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>(
          'BIM_JWT_SECRET',
          'bim-secret-change-me',
        ),
      });
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token BIM inválido o expirado');
    }
  }
}
