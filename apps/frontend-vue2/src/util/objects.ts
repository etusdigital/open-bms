export const areObjectsEqual = (a: any, b: any) => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }

    const bothAreObjects = typeof a[key] === 'object' && typeof b[key] === 'object';
    if (!bothAreObjects && a[key].toString() !== b[key].toString()) {
      return false;
    }

    if (bothAreObjects && !areObjectsEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

const isNullOrUndefined = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

const isObject = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length === 0;
};

export const isEmptyValue = (value: unknown): boolean => {
  if (isNullOrUndefined(value) || Number.isNaN(value)) {
    return true;
  } else if (isObject(value) && Object.keys(value).length === 0) {
    return true;
  } else if (isEmptyString(value)) {
    return true;
  } else {
    return false;
  }
};

export const hasEmojiCharacters = (value: any) => {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const isEmojiRegex = emojiRegex.test(value);
  if (isEmojiRegex) {
    return false;
  }

  // accept placeholders
  if (/^%[a-zA-Z0-9_-]*%$/g.test(value)) {
    return true;
  }
  return true;
};

export const hasEspecialCharacters = (value: any) => {
  // accept placeholders
  if (/^%[a-zA-Z0-9_-]*%$/g.test(value)) {
    return true;
  }

  const invalidCharacters = [
    `+`,
    `±`,
    `×`,
    `÷`,
    `%`,
    `‰`,
    `=`,
    `≠`,
    `≈`,
    `≡`,
    `<`,
    `>`,
    `≤`,
    `≥`,
    `∞`,
    `⅛`,
    `¼`,
    `⅜`,
    `½`,
    `⅝`,
    `¾`,
    `⅞`,
    `∫`,
    `∂`,
    `∆`,
    `∏`,
    `∑`,
    `√`,
    `∟`,
    `∩`,
    `∙`,
    `ƒ`,
    `⁄`,
    `$`,
    `€`,
    `£`,
    `¥`,
    `¢`,
    `₣`,
    `₤`,
    `₧`,
    `¤`,
    `%`,
    `‰`,
    `"`,
    `#`,
    `&`,
    `*`,
    `,`,
    `-`,
    `.`,
    `/`,
    `@`,
    `^`,
    `_`,
    `{`,
    `|`,
    `}`,
    `~`,
    `„`,
    `…`,
    `†`,
    `‡`,
    `‹`,
    `‘`,
    `’`,
    `“`,
    `”`,
    `•`,
    `–`,
    `—`,
    `™`,
    `›`,
    ` `,
    `¦`,
    `©`,
    `ª`,
    `«`,
    `¬`,
    `­`,
    `®`,
    `°`,
    `²`,
    `³`,
    `µ`,
    `¶`,
    `·`,
    `¹`,
    `º`,
    `»`,
    `℅`,
    `ⁿ`,
    `§`,
    `¨`,
    `―`,
    `‣`,
    `‾`,
    `‼`,
    `№`,
    `!`,
    `?`,
    `:`,
    `;`,
    `'`,
    `"`,
    `'`,
    `"`,
  ];

  const isCharacters = invalidCharacters.filter((item: string) => value.includes(item));
  if (isCharacters && isCharacters.length) {
    return false;
  }
  return true;
};

export const setMenuTop = (activatorElement: HTMLElement, offset: number = 0) => {
  const menus = document.querySelectorAll('.v-menu__content.menuable__content__active');
  if (menus.length > 0) {
    const menu = menus[0] as HTMLElement;
    const rect = activatorElement.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const top = rect.bottom + scrollY + offset;
    menu.style.top = `${top}px`;
  }
};

export const setItemsPerPage = (key: string, items: number | string) => {
  const itemsPerPage = JSON.parse(localStorage.getItem('itemsPerPage') || '{}');
  itemsPerPage[key] = Number(items);
  localStorage.setItem('itemsPerPage', JSON.stringify(itemsPerPage));
};

export const getItemsPerPage = (key: string, defaultValue: number = 10): number => {
  const itemsPerPage = JSON.parse(localStorage.getItem('itemsPerPage') || '{}');
  const value = itemsPerPage[key];
  return value || defaultValue;
};

export const setTwoFaConfig = (key: string, value: any) => {
  const twoFaConfig = JSON.parse(localStorage.getItem('twoFaConfig') || '{}');
  twoFaConfig[key] = value;
  localStorage.setItem('twoFaConfig', JSON.stringify(twoFaConfig));
};

export const getTwoFaConfig = (key: string, defaultValue: any = []): any => {
  const twoFaConfig = JSON.parse(localStorage.getItem('twoFaConfig') || '{}');
  const value = twoFaConfig[key];
  return value || defaultValue;
};

export const setTwoFaCurrentGroup = (groupName: string) => {
  localStorage.setItem('twoFaCurrentGroup', groupName);
};

export const getTwoFaCurrentGroup = (): string | null => {
  return localStorage.getItem('twoFaCurrentGroup');
};

export const clearTwoFaCurrentGroup = () => {
  localStorage.removeItem('twoFaCurrentGroup');
};

export const extractLinks = (html: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = new Set<string>();

  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href && !href.includes('[unsubscribe_link]')) {
      links.add(href);
    }
  });
  return Array.from(links);
};

export const getPercentage = (partialNumber: number, totalNumber: number) => {
  if (!partialNumber || partialNumber === 0) {
    return 0;
  }
  if (!totalNumber || totalNumber === 0) {
    return 0;
  }
  const value = (partialNumber / totalNumber) * 100;
  return value.toFixed(2);
};
