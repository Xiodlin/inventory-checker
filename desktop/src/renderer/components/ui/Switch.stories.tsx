import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Switch } from '../UI';

const meta = {
  title: 'Components/Forms/Switch', component: Switch, tags: ['autodocs'],
  args: { label: 'Automatic checks', disabled: false },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
  parameters: { docs: { description: { component: 'A labeled native checkbox exposed as a switch. Space toggles it. Use for an on/off preference, not a multi-selection list.' } } },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('switch')).toBeChecked();
    await userEvent.click(canvas.getByRole('switch'));
    await expect(canvas.getByRole('switch')).not.toBeChecked();
  },
};
export const On: Story = { args: { defaultChecked: true } };
export const WithHelpText: Story = {
  args: { help: 'Checks run while this device is awake and the app is running.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toHaveAccessibleDescription('Checks run while this device is awake and the app is running.');
  },
};
export const DisabledOff: Story = { args: { disabled: true } };
export const DisabledOn: Story = { args: { disabled: true, defaultChecked: true } };
