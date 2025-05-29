// import { ConfigType } from '@nestjs/config';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import jwtConfig from '../config/jwt.config';
// import { AuthJwtPayload } from '../types/auth-jwtPayload';
// import { Inject, Injectable, NotFoundException } from '@nestjs/common';
// import { AuthService } from '../auth.service';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(
//     @Inject(jwtConfig.KEY)
//     private jwtConfiguration: ConfigType<typeof jwtConfig>,
//     private authService: AuthService,
//   ) {
//     if (!jwtConfiguration.secret) {
//       throw new NotFoundException('JWT secret is not defined');
//     }
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       secretOrKey: jwtConfiguration.secret,
//       ignoreExpiration: false,
//     });
//   }

//   validate(payload: AuthJwtPayload & { iat: number }) {
//     const userId = payload.sub;
//     const tokenIssuedAt = payload.iat;
//     return this.authService.validateJwtUser(userId, tokenIssuedAt);
//   }
// }

import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import { AuthJwtPayload } from '../types/auth-jwtPayload';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { accessTokenFromSessionCookie } from '../utility/jwt-cookie.extractor';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY)
    private jwtConfiguration: ConfigType<typeof jwtConfig>,
    private authService: AuthService,
  ) {
    if (!jwtConfiguration.secret) {
      throw new NotFoundException('JWT secret is not defined');
    }
    super({
      jwtFromRequest: accessTokenFromSessionCookie,
      secretOrKey: jwtConfiguration.secret,
      ignoreExpiration: false,
    });
  }

  validate(payload: AuthJwtPayload & { iat: number }) {
    const userId = payload.sub;
    const tokenIssuedAt = payload.iat;
    return this.authService.validateJwtUser(userId, tokenIssuedAt);
  }
}
