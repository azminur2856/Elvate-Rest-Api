import { Role } from '../enums/role.enum';

export type CurrentUser = {
  id: string;
  role: Role;
  /** session id of the login this request was made with */
  sid?: string;
};
