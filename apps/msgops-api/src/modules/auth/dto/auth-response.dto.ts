import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponse {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'Admin' })
  name: string;

  @ApiProperty({ nullable: true, example: null, description: 'Avatar URL' })
  picture: string | null;

  @ApiProperty({
    example: 'local|7a14a24b-2c21-4e4e-9f5f-5f5f5f5f5f5f',
    description: '`<provider>|<id>`. `local|*` for accounts managed by LocalAuthProvider; `auth0|*` for Auth0.',
  })
  providerId: string;
}

export class AuthLoginResponse {
  @ApiProperty({ description: 'JWT (HS256) — carry as `Authorization: Bearer <token>`.' })
  accessToken: string;

  @ApiProperty({ example: 3600, description: 'Access token lifetime in seconds.' })
  expiresIn: number;

  @ApiProperty({ type: AuthUserResponse })
  user: AuthUserResponse;
}

export class AuthRefreshResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 3600 })
  expiresIn: number;
}

export class AuthLogoutResponse {
  @ApiProperty({ example: true })
  success: boolean;
}
