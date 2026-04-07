import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: { roles?: string[] };
    }>();

    if (request.user?.roles?.includes('admin')) {
      return true;
    }

    throw new ForbiddenException('Admin role required');
  }
}
