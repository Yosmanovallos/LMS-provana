import { CanActivate, ExecutionContext, HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../ports/auth.port';
import { ErrorCode, Result } from '../modules/shared-kernel/result';
import { Container } from '../container';

export const CONTAINER = 'LMS_CONTAINER';

const statusByCode: Record<ErrorCode, number> = {
  'not-found': 404,
  forbidden: 403,
  validation: 400,
  conflict: 409,
  invariant: 422,
};

/** Maps shared-kernel Result errors to HTTP — controllers contain no logic. */
export function respond<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new HttpException(
      { error: result.error.code, message: result.error.message },
      statusByCode[result.error.code] ?? 500,
    );
  }
  return result.value;
}

export type AuthedRequest = Request & { actor: AuthenticatedUser };

export function actorOf(req: AuthedRequest): AuthenticatedUser {
  return req.actor;
}

const PUBLIC_PREFIXES = ['/health', '/docs', '/dev/personas'];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(CONTAINER) private readonly container: Container) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (PUBLIC_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return true;
    const actor = this.container.auth.authenticate(req.headers);
    if (!actor) throw new UnauthorizedException('Provide x-user-id and x-user-role headers (AUTH_MODE=dev)');
    req.actor = actor;
    return true;
  }
}
