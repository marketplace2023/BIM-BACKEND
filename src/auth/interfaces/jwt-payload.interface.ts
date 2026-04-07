export interface JwtPayload {
  sub: string;
  email?: string;
  tenant_id: string;
  partner_id: string;
  role?: string;
  roles?: string[];
}
