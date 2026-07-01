export type GarminTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: "bearer" | string;
  scope?: string;
  jti?: string;
  refresh_token_expires_in?: number;
};

export type GarminSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  refreshTokenExpiresAt?: number;
  scope?: string;
  tokenType: string;
  connectedAt: number;
  userId?: string;
  permissions?: string[];
};

export type GarminOAuthContext = {
  state: string;
  codeVerifier: string;
};

export type GarminUserIdResponse = {
  userId: string;
};

export type GarminPermissionsResponse = string[] | { permissions?: string[] };
