import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { PublicRoute } from '../authz/public-route.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthLoginResponse, AuthLogoutResponse, AuthRefreshResponse } from './dto/auth-response.dto';

const REFRESH_COOKIE_NAME = 'bms_refresh';

function cookieOptions() {
  const maxAge = parseInt(process.env.JWT_REFRESH_TTL || '2592000', 10) * 1000;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

function extractMeta(req: Request) {
  const forwarded = (req.headers['x-forwarded-for'] as string) || '';
  const ip = forwarded.split(',')[0]?.trim() || req.ip || undefined;
  const userAgent = (req.headers['user-agent'] as string) || undefined;
  return { ip, userAgent };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @PublicRoute()
  @ApiOperation({
    summary: 'Authenticate with email + password',
    description: 'Only mounted when `AUTH_PROVIDER=local`. Sets an httpOnly `bms_refresh` cookie for silent refresh; access token is in the body.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthLoginResponse, description: 'Credentials accepted. Also sets `Set-Cookie: bms_refresh=...; HttpOnly; SameSite=Lax; Path=/`.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials (generic — does not reveal whether the email exists).' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthLoginResponse> {
    const { refreshToken, ...response } = await this.authService.login(dto.email, dto.password, extractMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
    return response;
  }

  @Post('refresh')
  @PublicRoute()
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Reads the `bms_refresh` cookie, revokes it, and issues a new access + refresh pair. Replay of a rotated cookie returns 401 and emits a `refresh_token_reuse_detected` log.',
  })
  @ApiOkResponse({ type: AuthRefreshResponse })
  @ApiUnauthorizedResponse({ description: 'Cookie missing, expired, already rotated, or revoked.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthRefreshResponse> {
    const token = (req as any).cookies?.[REFRESH_COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    const { refreshToken, ...response } = await this.authService.refresh(token, extractMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
    return response;
  }

  @Post('logout')
  @PublicRoute()
  @ApiOperation({
    summary: 'Revoke the current refresh token and clear the cookie',
    description:
      'Idempotent — safe to call without a valid cookie. Also invalidates the AuthzService Redis cache for the user so permission changes apply immediately on next login.',
  })
  @ApiOkResponse({ type: AuthLogoutResponse })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthLogoutResponse> {
    const token = (req as any).cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
