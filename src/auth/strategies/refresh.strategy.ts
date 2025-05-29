// import { ConfigType } from '@nestjs/config';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import jwtConfig from '../config/jwt.config';
// import { AuthJwtPayload } from '../types/auth-jwtPayload';
// import { Inject, Injectable, NotFoundException } from '@nestjs/common';
// import refreshJwtConfig from '../config/refresh-jwt.config';
// import { Request } from 'express';
// import { AuthService } from '../auth.service';

// @Injectable()
// export class RefreshJwtStrategy extends PassportStrategy(
//   Strategy,
//   'refresh-jwt',
// ) {
//   constructor(
//     @Inject(refreshJwtConfig.KEY)
//     private refreshJwtConfiguration: ConfigType<typeof refreshJwtConfig>,
//     private authService: AuthService,
//   ) {
//     if (!refreshJwtConfiguration.secret) {
//       throw new NotFoundException('JWT secret is not defined');
//     }
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       secretOrKey: refreshJwtConfiguration.secret,
//       ignoreExpiration: false,
//       passReqToCallback: true,
//     });
//   }

//   validate(req: Request, payload: AuthJwtPayload) {
//     const refreshToken = req.get('authorization')?.replace('Bearer', '').trim();
//     const userId = payload.sub;
//     if (!refreshToken) {
//       throw new NotFoundException('Refresh token not found');
//     }
//     return this.authService.validateRefreshToken(userId, refreshToken);
//   }
// }

import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { AuthJwtPayload } from '../types/auth-jwtPayload';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import refreshJwtConfig from '../config/refresh-jwt.config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { refreshTokenFromSessionCookie } from '../utility/jwt-cookie.extractor';

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'refresh-jwt',
) {
  constructor(
    @Inject(refreshJwtConfig.KEY)
    private refreshJwtConfiguration: ConfigType<typeof refreshJwtConfig>,
    private authService: AuthService,
  ) {
    if (!refreshJwtConfiguration.secret) {
      throw new NotFoundException('JWT secret is not defined');
    }
    super({
      jwtFromRequest: refreshTokenFromSessionCookie,
      secretOrKey: refreshJwtConfiguration.secret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AuthJwtPayload) {
    const refreshToken = req['refreshToken']; // Assuming session is set in the request by a middleware
    const userId = payload.sub;
    if (!refreshToken) {
      throw new NotFoundException('Refresh token not found');
    }
    return this.authService.validateRefreshToken(userId, refreshToken);
  }
}
