import { MMKV } from 'react-native-mmkv';

export const preferencesStorage = new MMKV({
  id: 'financam.preferences',
});
