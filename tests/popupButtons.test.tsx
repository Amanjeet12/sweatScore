// @ts-nocheck -- Inert native hosts verify popup-scoped rendering without device actions.
import { expect, mock, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ButtonContext = React.createContext({});
const host = (tag) =>
  React.forwardRef(({ children, style, disabled }, ref) => {
    const resolved = typeof style === 'function' ? style({ pressed: true }) : style;
    const flat = Object.assign(
      {},
      ...(Array.isArray(resolved) ? resolved.flat(Infinity).filter(Boolean) : [resolved])
    );
    return React.createElement(
      tag,
      { 'data-style': JSON.stringify(flat), 'data-disabled': disabled },
      children
    );
  });
mock.module('react-native', () => ({
  ActivityIndicator: host('i'),
  Pressable: host('button'),
  Text: host('span'),
  View: host('div'),
}));
mock.module('@gluestack-ui/button', () => ({
  createButton: () =>
    Object.assign(
      React.forwardRef(({ context, children, ...props }, ref) =>
        React.createElement(
          ButtonContext.Provider,
          { value: context },
          React.createElement(host('button'), props, children)
        )
      ),
      { Text: host('span'), Spinner: host('i'), Icon: host('i'), Group: host('div') }
    ),
}));
mock.module('@gluestack-ui/icon', () => ({ PrimitiveIcon: host('i'), UIIcon: host('i') }));
mock.module('@gluestack-ui/nativewind-utils/tva', () => ({ tva: () => () => '' }));
mock.module('@gluestack-ui/nativewind-utils/withStyleContext', () => ({
  withStyleContext: (value) => value,
  useStyleContext: () => React.useContext(ButtonContext),
}));
mock.module('nativewind', () => ({ cssInterop: () => {} }));
const { Button, ButtonText } = await import('../components/ui/button');
const { PopupThemeContext } = await import('../components/ui/popupTheme');

const render = (popup, props = {}) =>
  renderToStaticMarkup(
    React.createElement(
      PopupThemeContext.Provider,
      { value: popup },
      React.createElement(
        Button,
        props,
        React.createElement(ButtonText, { style: { color: 'red' } }, 'Action')
      )
    )
  );

test('popup primary actions override old colours with charcoal and white text', () => {
  const html = render(true, { style: { backgroundColor: 'orange' }, disabled: true });
  expect(html).toContain('#2a2a2a');
  expect(html).toContain('#FFFFFF');
  expect(html).not.toContain('orange');
  expect(html).not.toContain('red');
  expect(html).toContain('data-disabled="true"');
});

test('popup secondary and cancel actions use grey with charcoal text', () => {
  for (const props of [{ action: 'secondary' }, { variant: 'outline', action: 'negative' }]) {
    const html = render(true, props);
    expect(html).toContain('#f5f5f5');
    expect(html).toContain('#2a2a2a');
  }
});

test('popup theme preserves callback styles and stays scoped to popups', () => {
  const props = {
    style: ({ pressed }) => ({ opacity: pressed ? 0.5 : 1, backgroundColor: 'orange' }),
  };
  expect(render(true, props)).toContain('0.5');
  expect(render(false, props)).toContain('orange');
  expect(render(false, props)).toContain('red');
  expect(render(false, props)).not.toContain('#2a2a2a');
});
