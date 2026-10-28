import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: () => Promise.resolve() }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom não implementa <dialog>.showModal/close
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
window.scrollTo = () => {};
URL.createObjectURL ??= () => 'blob:test';
URL.revokeObjectURL ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
