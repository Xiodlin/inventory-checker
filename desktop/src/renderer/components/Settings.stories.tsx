import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { sampleSettings } from '../../../.storybook/desktopApiStub';
import Settings from './Settings';

const meta = {
  component: Settings,
  tags: ['ai-generated'],
  args: { settings: sampleSettings, onSave: fn() },
} satisfies Meta<typeof Settings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SavesPreferences: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const interval = canvas.getByLabelText('Check interval (minutes)');
    await userEvent.clear(interval);
    await userEvent.type(interval, '60');
    await userEvent.click(canvas.getByRole('button', { name: 'Save preferences' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('Preferences saved.');
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ check_interval_minutes: 60, notifications_enabled: true }),
    );
  },
};

export const CompactSections: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByLabelText('Best Buy API key')).not.toBeInTheDocument();
    const backup = canvas.getByRole('button', { name: 'Export local backup', hidden: true });
    await expect(backup).not.toBeVisible();
    await userEvent.click(canvas.getByText('Backups & local data'));
    await expect(backup).toBeVisible();
    await userEvent.click(canvas.getByText('Backups & local data'));
    await expect(backup).not.toBeVisible();
  },
};
