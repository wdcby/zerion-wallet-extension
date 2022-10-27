import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { WindowSize } from 'src/ui-lab/components/WindowSize';
import type { Readme } from 'src/ui-lab/types';
import { RequestAccounts } from './RequestAccounts';

export const readme: Readme = {
  name: 'RequestAccounts',
  description: null,
  component: () => (
    <MemoryRouter
      initialEntries={[
        `/requestAccounts?${new URLSearchParams({
          origin: 'https://zerion.io',
          windowId: '1',
        })}`,
      ]}
    >
      <WindowSize>
        <RequestAccounts />
      </WindowSize>
    </MemoryRouter>
  ),
};
