require('@testing-library/jest-dom');

/* global jest */
const { window } = globalThis;

const { getComputedStyle } = window;
window.getComputedStyle = (elt) => getComputedStyle(elt);
window.HTMLElement.prototype.scrollIntoView = () => {};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

class ResizeObserver {
  // eslint-disable-next-line class-methods-use-this -- mock must satisfy the ResizeObserver instance interface; there is no instance state
  observe() {}

  // eslint-disable-next-line class-methods-use-this -- mock must satisfy the ResizeObserver instance interface; there is no instance state
  unobserve() {}

  // eslint-disable-next-line class-methods-use-this -- mock must satisfy the ResizeObserver instance interface; there is no instance state
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
