import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Spinner } from '../UI';

const meta = {
  title: 'Components/Feedback/Spinner', component: Spinner, tags: ['autodocs'],
  args: { label: 'Loading offers…' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Labeled status indicator. The decorative ring is hidden from assistive technology; the status text remains available when reduced motion disables animation.' } } },
} satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas }) => { await expect(canvas.getByRole('status')).toHaveTextContent('Loading offers…'); },
};
export const Checking: Story = { args: { label: 'Checking product availability…' } };
export const Saving: Story = { args: { label: 'Saving preferences…' } };
