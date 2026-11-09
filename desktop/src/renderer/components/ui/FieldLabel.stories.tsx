import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { FieldLabel } from '../UI';

const meta = {
  title: 'Components/Forms/Field Label', component: FieldLabel, tags: ['autodocs'],
  args: { htmlFor: 'label-example', children: 'Product name' },
  decorators: [Story => <div className="ui-kit"><Story /></div>],
} satisfies Meta<typeof FieldLabel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Required: Story = { args: { required: true } };
export const Optional: Story = { args: { children: 'Example link (optional)' } };
function LabeledControl() {
  const id = useId();
  return <div className="ui-field"><FieldLabel htmlFor={id}>Product name</FieldLabel><input id={id} /></div>;
}
export const ClickToFocus: Story = {
  render: () => <LabeledControl />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('Product name'));
    await expect(canvas.getByRole('textbox', { name: 'Product name' })).toHaveFocus();
  },
};
