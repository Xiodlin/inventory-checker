import type { Preview } from '@storybook/react-vite'
import '../src/styles/app.css'
import { installDesktopApiStub } from './desktopApiStub'

const preview: Preview = {
  beforeEach() {
    // The desktop renderer reads all data through the Electron IPC bridge.
    installDesktopApiStub();
  },
  parameters: {
    layout: 'padded',
    options: { storySort: { order: ['Foundations', 'Components', ['Overview', 'Actions', 'Forms', 'Display', 'Feedback', 'Navigation', 'Data'], 'Patterns', 'Application', 'Monitoring', 'Preferences', 'Legacy'] } },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;