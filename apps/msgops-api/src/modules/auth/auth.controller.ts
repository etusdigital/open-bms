import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PublicRoute } from '../authz/public-route.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...response } = await this.authService.login(dto.email, dto.password, extractMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
    return response;
  }

  @Post('refresh')
  @PublicRoute()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).cookies?.[REFRESH_COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    const { refreshToken, ...response } = await this.authService.refresh(token, extractMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
    return response;
  }

  @Post('logout')
  @PublicRoute()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as any).cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
