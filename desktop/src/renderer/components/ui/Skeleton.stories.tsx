import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Skeleton, Spinner } from '../UI';

const meta = {
  title: 'Components/Feedback/Skeleton', component: Skeleton, tags: ['autodocs'],
  args: { shape: 'text' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Static decorative placeholder, hidden from assistive technology. Put aria-busy on the loading region and supply one status message for the group. No shimmer or unnecessary motion.' } } },
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Text: Story = {};
export const Circle: Story = { args: { shape: 'circle' } };
export const Card: Story = { args: { shape: 'card' } };
export const LoadingRegion: Story = {
  render: () => <section className="ui-state" aria-busy="true" aria-label="Loading offers"><Spinner label="Loading offers…" /><Skeleton shape="circle" /><Skeleton /><Skeleton /><Skeleton shape="card" /></section>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Loading offers' })).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
  },
};
