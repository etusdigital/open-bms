export const parameters = {
  a11y: {
    options: {
      runOnly: {
        type: 'tag',
        values: ['wcag2a'],
      },
    },
  },
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  options: {
    storySort: {
      method: 'alphabetical',
      order: ['Start Here'],
    },
  },
  backgrounds: {
    default: 'primary',
    values: [
      {
        name: 'primary',
        value: '#ffffff',
      },
      {
        name: 'inverted',
        value: '#121619',
      },
    ],
  },
};
