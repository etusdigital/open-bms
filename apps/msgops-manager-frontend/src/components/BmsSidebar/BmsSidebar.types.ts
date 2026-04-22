import { BmsSidebarItemProps } from './BmsSidebarItem.vue';

export type SidebarItem = Omit<BmsSidebarItemProps, 'size'> & {
  clickMenuItem: () => void;
  value: string;
  hideFromRoles: string[];
};
