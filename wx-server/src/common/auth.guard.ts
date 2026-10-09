import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  createParamDecorator,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export interface JwtUser {
  uid: number;        // user.id（用户端）或 staff.id（店员端）
  type: 'USER' | 'STAFF';
  role?: 'STAFF' | 'MANAGER' | 'OWNER'; // 仅 STAFF 类型
  storeId?: number;
  nickname?: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUser => ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录');
    }
    try {
      const payload = this.jwt.verify<JwtUser>(auth.slice(7));
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest().user as JwtUser | undefined;
    if (!user) throw new ForbiddenException('无权限访问');
    if (user.type === 'USER') throw new ForbiddenException('请使用店员端账号操作');
    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenException('当前账号无此操作权限');
    }
    return true;
  }
}