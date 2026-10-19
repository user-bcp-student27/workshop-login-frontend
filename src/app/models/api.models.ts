export interface User {
  username?: string;
  displayName?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  client: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
}

export interface Task {
  title?: string;
  description?: string;
  status?: string;
  priority?: string | number;
  owner?: string | number | null;
  label?: string;
}

export interface Preferences {
  theme: string | null;
  showTips: boolean;
  compact: boolean;
  [key: string]: unknown;
}