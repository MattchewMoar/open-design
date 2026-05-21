// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AvatarMenu } from '../../src/components/AvatarMenu';
import type { AgentInfo, AppConfig } from '../../src/types';

vi.mock('../../src/i18n', () => ({
  useT: () => (key: string) => key,
}));

const config: AppConfig = {
  mode: 'api',
  apiKey: '',
  baseUrl: 'https://api.example.test',
  model: '',
  agentId: null,
  skillId: null,
  designSystemId: null,
};

afterEach(() => {
  cleanup();
});

describe('AvatarMenu', () => {
  it('returns focus to the trigger when Escape closes the menu', () => {
    render(
      <AvatarMenu
        config={config}
        agents={[] as AgentInfo[]}
        daemonLive
        onModeChange={vi.fn()}
        onAgentChange={vi.fn()}
        onAgentModelChange={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefreshAgents={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'avatar.title' });
    fireEvent.click(trigger);

    const apiItem = screen.getByRole('button', { name: /avatar.useApi/ });
    apiItem.focus();
    expect(document.activeElement).toBe(apiItem);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
