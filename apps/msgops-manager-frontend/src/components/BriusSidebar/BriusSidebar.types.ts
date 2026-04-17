import { BriusSidebarItemProps } from './BriusSidebarItem.vue';

export type SidebarItem = Omit<BriusSidebarItemProps, 'size'> & {
  clickMenuItem: () => void;
  value: string;
  hideFromRoles: string[];
};
