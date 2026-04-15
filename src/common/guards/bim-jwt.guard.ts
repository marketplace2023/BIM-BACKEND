import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CanActivate } from '@nestjs/common';

type GuardPayload = {
  sub?: string;
  id?: string;
  platform_user_id?: string;
  tenant_id?: string;
  partner_id?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

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
      const payload = this.verifyWithSupportedSecrets(token);
      const resolvedUserId =
        payload.platform_user_id ?? payload.id ?? payload.sub;

      req.user = {
        ...payload,
        id: resolvedUserId,
        sub: payload.sub ?? resolvedUserId,
        platform_user_id: payload.platform_user_id ?? resolvedUserId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token BIM inválido o expirado');
    }
  }

  private verifyWithSupportedSecrets(token: string): GuardPayload {
    const secrets = [
      this.config.get<string>('BIM_JWT_SECRET', 'bim-secret-change-me'),
      this.config.get<string>('JWT_SECRET', 'changeme'),
    ].filter(
      (secret, index, list): secret is string =>
        Boolean(secret) && list.indexOf(secret) === index,
    );

    for (const secret of secrets) {
      try {
        return this.jwtService.verify<GuardPayload>(token, { secret });
      } catch {
        continue;
      }
    }

    throw new UnauthorizedException('Token BIM inválido o expirado');
  }
}
