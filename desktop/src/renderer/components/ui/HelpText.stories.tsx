import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { HelpText, Input } from '../UI';

const meta = {
  title: 'Components/Forms/Help Text', component: HelpText, tags: ['autodocs'],
  args: { children: 'Checks run while this device is awake and the app is running.', tone: 'muted' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Persistent guidance beneath a control. Associate it with aria-describedby. Errors must use words as well as color. Use role="alert" only for newly appearing urgent feedback, not every static example.' } } },
} satisfies Meta<typeof HelpText>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Error: Story = { args: { tone: 'error', children: 'Enter a value between 5 and 10,080 minutes.' } };
export const Success: Story = { args: { tone: 'success', children: 'Preferences saved on this device.' } };
export const LongGuidance: Story = {
  args: { children: 'Seller evidence describes what was verified, not whether a seller is safe. Marketplace recognition does not assess third-party merchants. Shipping, tax, and stock may differ from the listed price.' },
};
export const AssociatedWithInput: Story = {
  render: () => <Input label="Required text" help="Only offers containing every word match." />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toHaveAccessibleDescription('Only offers containing every word match.');
  },
};
