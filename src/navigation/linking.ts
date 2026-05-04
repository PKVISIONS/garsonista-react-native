import type {LinkingOptions} from '@react-navigation/native';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'garsonista_offline://',
    'https://garsonista.datapp.gr',
    'https://garsonista4.datapp.gr',
  ],
  config: {
    screens: {
      [ROUTES.Start]: 'start',
      [ROUTES.Login]: 'login',
      [ROUTES.PlaceOrder]: 'place-order',
      [ROUTES.DiningChoice]: 'dining',
      [ROUTES.Menu]: 'menu',
      [ROUTES.OrderReview]: 'order',
      [ROUTES.OrderComplete]: 'complete',
      [ROUTES.CardFailed]: 'card-failed',
    },
  },
};
