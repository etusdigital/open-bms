// Vuetify
import { ThemeDefinition } from 'vuetify';

export const colors = {
  'tw-blue': '#1fb6ff',
  'tw-purple': '#7e5bef',
  'tw-pink': '#ff49db',
  'tw-orange': '#ff7849',
  'tw-green': '#13ce66',
  'tw-yellow': '#ffc82c',
  'tw-gray-dark': '#273444',
  'tw-gray': '#8492a6',
  'tw-gray-light': '#d3dce6',
};

export const briusLightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#6200EE',
    'primary-darken-1': '#3700B3',
    secondary: '#03DAC6',
    'secondary-darken-1': '#018786',
    error: '#B00020',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',
    ...colors,
  },
};
