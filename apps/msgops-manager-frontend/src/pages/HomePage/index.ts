import { Business } from '@vicons/ionicons5';
import { PageRouteRecordRaw } from '../pages.types';
import HomePage from './HomePage.vue';

export const homePageRouter: PageRouteRecordRaw = {
  component: HomePage,
  name: 'homePage',
  path: '/',
  icon: Business,
  label: 'Home',
};

export default HomePage;
