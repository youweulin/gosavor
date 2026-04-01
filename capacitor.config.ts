import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gosavor.app',
  appName: 'GoSavor',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
  // server: { url: 'http://localhost:5180', cleartext: true }, // uncomment for dev
};

export default config;
