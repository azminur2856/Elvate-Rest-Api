import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleOauthConfig from '../config/google-oauth.config';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { CookieStateStore } from '../utility/oauth-state-store';

/** Google's `email_verified` (a boolean; tolerate the string form). */
export const isGoogleVerified = (verified: unknown): boolean =>
  verified === true || verified === 'true';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private googleConfiguration: ConfigType<typeof googleOauthConfig>,
    private authService: AuthService,
  ) {
    if (!googleConfiguration.clientId) {
      throw new Error('Google client ID is not defined');
    }
    if (!googleConfiguration.clientSecret) {
      throw new Error('Google client secret is not defined');
    }
    if (!googleConfiguration.callbackUrl) {
      throw new Error('Google callback URL is not defined');
    }
    super({
      clientID: googleConfiguration.clientId,
      clientSecret: googleConfiguration.clientSecret,
      callbackURL: googleConfiguration.callbackUrl,
      scope: ['email', 'profile'],
      // SEC-08: OAuth `state` in a short-lived cookie (no server sessions)
      store: new CookieStateStore(),
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(null, false);
    }
    // SEC-08: only addresses Google itself has verified may sign in/link
    if (!isGoogleVerified(profile.emails?.[0]?.verified)) {
      return done(null, false);
    }
    try {
      // phone is omitted on purpose: it is unique, so it must stay NULL, not ''.
      const user = await this.authService.validateGoogleUser({
        firstName: profile.name?.givenName ?? profile.displayName ?? 'User',
        lastName: profile.name?.familyName,
        email,
        password: '',
        isActive: true,
        isEmailVerified: true,
      });
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
