export interface AuthRouterContext {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RouterContext {
  auth: AuthRouterContext;
}
