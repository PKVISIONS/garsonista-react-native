/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../src/navigation/AppNavigator', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    AppNavigator: () => React.createElement(View, {testID: 'nav-mock'}),
  };
});

jest.mock('../src/stores/Localization/LocalizationStore', () => {
  const localizationStore = {
    currentLanguageCode: 'el',
    supportedLanguages: [
      {code: 'el', label: '🇬🇷'},
      {code: 'en', label: '🇬🇧'},
    ],
    start: jest.fn(async () => {}),
    changeLanguage: jest.fn(async () => {}),
    translate: jest.fn((pathKey: string) => pathKey),
  };
  return {
    __esModule: true,
    default: localizationStore,
    localizationStore,
    translate: (pathKey: string) => pathKey,
  };
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
});
