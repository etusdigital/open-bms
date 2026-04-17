import { Locales } from '../locales';

import enUs from './en-US/index.json';
import ptBR from './pt-BR/index.json';

export const messages = {
  [Locales.EN_US]: enUs,
  [Locales.PT_BR]: ptBR,
};

export const defaultLocale = Locales.PT_BR;
