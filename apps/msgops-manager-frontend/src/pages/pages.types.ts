import type { RouteRecordRaw } from 'vue-router';
export type PageRouteRecordRaw = RouteRecordRaw & { icon?: unknown; label?: string; hideFromRoles?: string[] };
