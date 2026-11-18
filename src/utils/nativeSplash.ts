import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

export async function hideNativeSplash(fadeOutDuration = 450): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration });
  } catch {
    // Splash screen already hidden or unavailable
  }
}

export async function showNativeSplash(showDuration = 1800): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.show({
      autoHide: true,
      showDuration,
      fadeInDuration: 250,
      fadeOutDuration: 450,
    });
  } catch {
    // Ignore when splash dialog cannot open
  }
}
