import type { Meta, StoryObj } from '@storybook/vue3';
import BmsButton from './BmsButton.vue';

const meta: Meta<typeof BmsButton> = {
  title: 'BMS/BmsButton',
  component: BmsButton,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'delete'] },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof BmsButton>;

export const Primary: Story = {
  args: { name: 'btn-primary', variant: 'primary', disabled: false },
  render: (args) => ({
    components: { BmsButton },
    setup: () => ({ args }),
    template: '<BmsButton v-bind="args">Save</BmsButton>',
  }),
};

export const Secondary: Story = {
  args: { name: 'btn-secondary', variant: 'secondary', disabled: false },
  render: (args) => ({
    components: { BmsButton },
    setup: () => ({ args }),
    template: '<BmsButton v-bind="args">Cancel</BmsButton>',
  }),
};

export const Delete: Story = {
  args: { name: 'btn-delete', variant: 'delete', disabled: false },
  render: (args) => ({
    components: { BmsButton },
    setup: () => ({ args }),
    template: '<BmsButton v-bind="args">Delete</BmsButton>',
  }),
};

export const Disabled: Story = {
  args: { name: 'btn-disabled', variant: 'primary', disabled: true },
  render: (args) => ({
    components: { BmsButton },
    setup: () => ({ args }),
    template: '<BmsButton v-bind="args">Disabled</BmsButton>',
  }),
};
