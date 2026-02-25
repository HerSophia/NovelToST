import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, vi } from 'vitest';
import { installSTGlobalMocks, resetSTGlobalMockState } from './st-globals.mock';

installSTGlobalMocks();
resetSTGlobalMockState();

beforeEach(() => {
  setActivePinia(createPinia());
  resetSTGlobalMockState();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});
