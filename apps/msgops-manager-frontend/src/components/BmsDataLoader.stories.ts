import type { Meta, StoryObj } from '@storybook/vue3';
import BmsDataLoader from './BmsDataLoader.vue';

const meta: Meta<typeof BmsDataLoader> = {
  title: 'BMS/BmsDataLoader',
  component: BmsDataLoader,
  argTypes: {
    isLoading: { control: 'boolean' },
    type: { control: 'text' },
    height: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof BmsDataLoader>;

export const Loading: Story = {
  args: { isLoading: true, type: 'card', height: '200px' },
  render: (args) => ({
    components: { BmsDataLoader },
    setup: () => ({ args }),
    template: '<BmsDataLoader v-bind="args" />',
  }),
};

export const NotLoading: Story = {
  args: { isLoading: false },
  render: (args) => ({
    components: { BmsDataLoader },
    setup: () => ({ args }),
    template: '<BmsDataLoader v-bind="args"><div>Content loaded</div></BmsDataLoader>',
  }),
};
