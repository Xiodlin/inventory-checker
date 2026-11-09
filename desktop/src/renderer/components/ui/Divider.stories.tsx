import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider, HelpText } from '../UI';

const meta = {
  title: 'Components/Display/Divider', component: Divider, tags: ['autodocs'],
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof Divider>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const BetweenSections: Story = {
  render: () => <div><h2>Monitoring preferences</h2><HelpText>Choose when checks run.</HelpText><Divider /><h2>Backups</h2><HelpText>Export or restore device-local data.</HelpText></div>,
};
