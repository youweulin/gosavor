import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gosavor.app',
  appName: 'GoSavor',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
