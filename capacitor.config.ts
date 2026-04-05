import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shukkuu.app',
  appName: 'Shukkuu',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '553665072411-o357vn2e1e83r9o3pvgr5rgrlos209r3.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
