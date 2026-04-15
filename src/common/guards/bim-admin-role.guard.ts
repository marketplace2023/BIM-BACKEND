import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class BimAdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string; roles?: string[] };
    }>();

    if (
      request.user?.role === 'admin' ||
      request.user?.roles?.includes('admin')
    ) {
      return true;
    }

    throw new ForbiddenException('Admin role required');
  }
}
