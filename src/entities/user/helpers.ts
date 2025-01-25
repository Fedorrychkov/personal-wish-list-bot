import { UserRole } from './user.types'

export const validateGuardRole = (definedRoles: UserRole[], guardRoles: UserRole[]) => {
  return definedRoles.some((role) => guardRoles.includes(role))
}
