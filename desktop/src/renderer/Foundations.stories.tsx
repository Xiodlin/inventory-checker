import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import '../styles/tokens.css';
import '../styles/foundations.css';

function Foundation({ children }: { children: ReactNode }) {
  return <main className="ds-preview">{children}</main>;
}
const meta = {
  title: 'Foundations/Design system',
  component: Foundation,
  tags: ['autodocs'],
  args: { children: null },
  parameters: { docs: { description: { component: 'Inventory Checker token reference. The desktop application and component catalog share these semantic tokens for surfaces, controls, typography, spacing, focus and motion. Fonts use local fallbacks. No external resources are fetched.' } } },
} satisfies Meta<typeof Foundation>;
export default meta;
type Story = StoryObj<typeof meta>;
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
const variable = (token: string) => `var(--${token})`;

export const ColorScales: Story = {
  render: () => <Foundation><h1>Role-based color scales</h1>{['primary', 'secondary', 'accent', 'neutral'].map(role => <section key={role}>
    <h2>{role}</h2><div className="ds-grid">{steps.map(step => <figure key={step}>
      <div className="ds-swatch" style={{ background: variable(`${role}-${step}`) }} />
      <figcaption><code>--{role}-{step}</code></figcaption>
    </figure>)}</div></section>)}</Foundation>,
};
export const SemanticSurfacesAndStates: Story = {
  render: () => <Foundation><h1>Surfaces and functional states</h1>
    <div className="ds-grid">{['canvas', 'surface', 'surface-raised', 'inset', 'selected', 'disabled'].map(surface => <article className="ds-tile" key={surface} style={{ background: variable(`bg-${surface}`) }}>
      <h2>{surface}</h2><p>Primary text</p><p style={{ color: variable('text-muted') }}>Supporting text</p><code>--bg-{surface}</code>
    </article>)}</div>
    <div className="ds-grid">{['success', 'warning', 'error', 'info', 'unknown', 'sale'].map(state => <article className="ds-tile" key={state}
      style={{ background: variable(`status-${state}-bg`), color: variable(`status-${state}-text`), borderColor: variable(`status-${state}-border`) }}>
      <h2>{state}</h2><p>Explicit text accompanies color.</p>
    </article>)}</div>
  </Foundation>,
};
export const Typography: Story = {
  render: () => <Foundation><h1>Typography - Major Third (1.25)</h1><p>Inter / system UI; JetBrains Mono / system monospace. Base: 1rem.</p>
    {sizes.map(size => <section key={size}><code>--font-size-{size} / --line-height-{size} / --letter-spacing-{size}</code>
      <p style={{ fontSize: variable(`font-size-${size}`), lineHeight: variable(`line-height-${size}`), letterSpacing: variable(`letter-spacing-${size}`) }}>Inventory at a glance</p>
    </section>)}
  </Foundation>,
};
export const SpacingAndSizing: Story = {
  render: () => <Foundation><h1>4px spacing scale</h1><p>Increments 0-24, expressed in rem to respect text scaling.</p>
    {Array.from({ length: 25 }, (_, step) => <div className="ds-spacing-row" key={step}>
      <code>--space-{step}: {step * 4}px</code><span style={{ width: variable(`space-${step}`), height: variable('space-3'), background: variable('text-link') }} />
    </div>)}
    <section className="ds-tile"><h2>Semantic spacing</h2><p>Component: 16px; compact: 12px; section: 24px; section gap: 32px.</p>
      <p>Inputs: 8px block / 12px inline; controls: minimum 44px. Stack gaps: 8 / 12 / 24px.</p></section>
  </Foundation>,
};
export const ElevationRadiusAndMotion: Story = {
  render: () => <Foundation><h1>Effects and elevation</h1>
    <div className="ds-grid">{['sm', 'md', 'lg', 'xl', '2xl'].map(size => <article className="ds-tile" key={size} style={{ boxShadow: variable(`shadow-${size}`) }}>
      <h2>Shadow {size}</h2><code>--shadow-{size}</code></article>)}</div>
    <div className="ds-grid">{['sm', 'md', 'lg', 'full'].map(size => <article className="ds-tile" key={size} style={{ borderRadius: variable(`radius-${size}`) }}>
      Radius {size}</article>)}</div>
    <p>sm: badges; md: controls; lg: cards/dialogs; full: pills. Ordinary cards stay flat.</p>
    <button className="ds-button">Hover / keyboard focus: 150ms</button>
    <p>Disclosure: 250ms; view changes: 400ms. Reduced-motion preference sets durations to zero.</p>
  </Foundation>,
};
export const ProductCardExample: Story = {
  render: () => <Foundation><article className="ds-tile ds-product">
    <h1>MacBook Neo - 256GB, Indigo</h1>
    <div className="ds-tags">{[['success', 'In Stock'], ['sale', 'On Sale'], ['unknown', 'Lowest found: $1,999.00']].map(([state, label]) => <span className="ds-badge" key={label}
      style={{ background: variable(`status-${state}-bg`), color: variable(`status-${state}-text`), borderColor: variable(`status-${state}-border`) }}>{label}</span>)}</div>
    <p>Illustrative data only, not a live stock report.</p>
    <label htmlFor="ds-reference">Reference URL<input id="ds-reference" type="url" aria-describedby="ds-reference-help" placeholder="https://retailer.example/product" /></label>
    <p id="ds-reference-help">Example input only; no data is saved or fetched.</p>
    <details><summary>Apple - 2 listings</summary><p>Vendor listings go here.</p></details>
    <button className="ds-button" disabled>No pending changes</button>
  </article></Foundation>,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Reference URL');
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.type(input, 'https://retailer.example/product');
    await expect(input).toHaveValue('https://retailer.example/product');
    await userEvent.click(canvas.getByText('Apple - 2 listings'));
    await expect(canvas.getByText('Vendor listings go here.')).toBeVisible();
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'No pending changes' })).cursor).toBe('default');
  },
};
export const TokenIntegrity: Story = {
  render: ProductCardExample.render,
  play: async ({ canvas }) => {
    const root = canvas.getByRole('article');
    const styles = getComputedStyle(root);
    for (const role of ['primary', 'secondary', 'accent', 'neutral']) for (const step of steps) {
      await expect(styles.getPropertyValue(`--${role}-${step}`).trim()).not.toBe('');
    }
    for (let step = 0; step <= 24; step++) {
      await expect(parseFloat(styles.getPropertyValue(`--space-${step}`))).toBe(step / 4);
    }
    for (let index = 0; index < sizes.length; index++) {
      const size = sizes[index];
      await expect(parseFloat(styles.getPropertyValue(`--line-height-${size}`))).toBeGreaterThan(1);
      await expect(styles.getPropertyValue(`--letter-spacing-${size}`).trim()).not.toBe('');
      if (index) {
        const ratio = parseFloat(styles.getPropertyValue(`--font-size-${size}`))
          / parseFloat(styles.getPropertyValue(`--font-size-${sizes[index - 1]}`));
        await expect(ratio).toBeCloseTo(1.25, 8);
      }
    }
    const reduced = root.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const [name, duration] of [['fast', '150ms'], ['normal', '250ms'], ['slow', '400ms']]) {
      await expect(styles.getPropertyValue(`--duration-${name}`).trim()).toBe(reduced ? '0ms' : duration);
    }
  },
};
