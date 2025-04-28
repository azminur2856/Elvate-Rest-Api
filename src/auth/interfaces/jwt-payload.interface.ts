/**
 * Interface representing the JWT payload structure.
 * @interface JwtPayload
 * @description Defines the structure of the data stored in JWT tokens.
 */
export interface JwtPayload {
  /**
   * Subject - typically the user ID
   * @type {string}
   */
  sub: string;

  /**
   * User's email address
   * @type {string}
   */
  email: string;

  /**
   * User's role
   * @type {string}
   */
  role: string;

  /**
   * Token expiration timestamp
   * @type {number}
   */
  exp?: number;
}
