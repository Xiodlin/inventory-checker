import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Tabs } from '../UI';

const meta = {
  title: 'Components/Navigation/Tabs', component: Tabs, tags: ['autodocs'],
  args: { label: 'Product details', items: [{ label: 'Offers', content: <p>Offers content</p> }, { label: 'History', content: <p>History content</p> }, { label: 'Alerts', content: <p>Alerts content</p> }] },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'Automatic-activation tabs with roving focus. Arrow keys wrap and skip disabled tabs. Home/End select the first/last enabled tab. Each tab names its own panel.' } } },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'History' }));
    await expect(canvas.getByRole('tabpanel', { name: 'History' })).toHaveTextContent('History content');
    await expect(canvas.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  },
};
export const KeyboardNavigation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'History' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('tab', { name: 'Alerts' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Offers' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('tab', { name: 'Alerts' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(canvas.getByRole('tabpanel', { name: 'Offers' })).toBeVisible();
  },
};
export const DisabledTab: Story = {
  args: { items: [{ label: 'Offers', content: 'Offers content' }, { label: 'History', content: 'History content', disabled: true }, { label: 'Alerts', content: 'Alerts content' }] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Offers' }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Alerts' })).toHaveFocus();
    await expect(canvas.getByRole('tab', { name: 'History' })).toBeDisabled();
  },
};
export const DisabledFirstTab: Story = {
  args: { items: [{ label: 'Unavailable', content: 'Unavailable content', disabled: true }, { label: 'Offers', content: 'Offers content' }] },
  play: async ({ canvas }) => { await expect(canvas.getByRole('tabpanel', { name: 'Offers' })).toBeVisible(); },
};
