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

export const KeyHelpDialog: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'How to get a key' }));
    const dialog = canvas.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName('How to get a Best Buy API key');
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
  },
};
