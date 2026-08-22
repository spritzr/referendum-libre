/**
 * Expo config plugin: enable Fresco's animated-WebP decoder on Android.
 *
 * Why this is required (not optional):
 *   The illustrated steps in the voting flow (Step1/2/3/4/6/7/10, Step9Vote and
 *   the Comprendre hero) render short looping animations through React Native's
 *   <Image>. On Android that goes through Fresco, and Fresco ships *no* animated
 *   image decoders by default — the bare template gates each one behind a gradle
 *   property:
 *
 *     def isWebpEnabled        = (findProperty('expo.webp.enabled')  ?: "") == "true"
 *     def isWebpAnimatedEnabled= (findProperty('expo.webp.animated') ?: "") == "true"
 *     if (isWebpEnabled) {
 *       implementation("com.facebook.fresco:webpsupport:...")
 *       if (isWebpAnimatedEnabled) {
 *         implementation("com.facebook.fresco:animated-webp:...")
 *       }
 *     }
 *
 *   Note animated-webp is nested inside the webpsupport branch, so BOTH
 *   properties are required — setting `expo.webp.animated` alone silently does
 *   nothing. Without them the .webp assets decode as a still first frame (or
 *   fail outright), which is exactly the "no motion on Android" regression the
 *   move away from ExoPlayer was meant to fix.
 *
 *   NOTE (superseded for the step animations): those call sites now render
 *   through expo-image, which is backed by Glide on Android (+ the
 *   penfeizhou glide-plugin animated decoder) and SDWebImage/
 *   SDWebImageWebPCoder on iOS. Neither uses Fresco, so the properties below
 *   are no longer what makes those animations move. This plugin is kept for
 *   any *plain* react-native <Image> that renders a WebP: that path still goes
 *   through Fresco and would otherwise regress to a still frame.
 *
 *   Do NOT infer from this that iOS is fine by default. It was that
 *   assumption — "animated WebP is decoded natively on iOS" — that shipped a
 *   regression: true of ImageIO, false of react-native's <Image>, whose only
 *   animated decoder is RCTGIFImageDecoder, gated on a literal GIF87a/GIF89a
 *   magic-byte check. A WebP fails that test and renders as a still first
 *   frame. Animated WebP on iOS requires expo-image (or another SDWebImage
 *   -backed view); react-native's <Image> cannot animate it.
 *
 * A direct edit to android/app/gradle.properties works for the current dev APK
 * but is wiped on the next `expo prebuild --clean` (the android/ folder is
 * gitignored and regenerated). This plugin makes the properties survive every
 * prebuild.
 */

const { withGradleProperties } = require('@expo/config-plugins');

const PROPERTIES = [
  // Pulls in com.facebook.fresco:webpsupport (static WebP + the gate for the
  // animated decoder below).
  'expo.webp.enabled',
  // Pulls in com.facebook.fresco:animated-webp.
  'expo.webp.animated',
];

module.exports = function withAnimatedWebp(config) {
  return withGradleProperties(config, (cfg) => {
    for (const key of PROPERTIES) {
      // Replace any existing entry so a stale `false` from a previous prebuild
      // (or a template default) can't win over ours.
      cfg.modResults = cfg.modResults.filter(
        (item) => !(item.type === 'property' && item.key === key)
      );
      cfg.modResults.push({ type: 'property', key, value: 'true' });
    }
    return cfg;
  });
};
