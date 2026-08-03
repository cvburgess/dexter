// DEX-85: turn the generated iOS project into a Mac Catalyst target.
//
// Only applied when `EXPO_MAC_CATALYST=1` — see `app.config.ts`, which is the
// one place that flag is read. This project is fully CNG (`ios/` is generated
// and gitignored), so every Xcode and CocoaPods change has to be expressed here
// rather than clicked in Xcode.
//
// Three mods:
//
//   1. `withXcodeProject` — flip the app target to Catalyst and, critically,
//      ask for the *Mac* idiom rather than a scaled iPad canvas.
//   2. `withPodfile`      — flip React Native's own Catalyst switch and make
//                           every pod target Catalyst-eligible.
//   3. `withEntitlementsPlist` — drop the App Group, which on macOS needs a
//                           team prefix and real provisioning.
//
// On "Optimize Interface for Mac": it is `TARGETED_DEVICE_FAMILY` containing
// `6`, and nothing else. `MacOSX.sdk/SDKSettings.plist` declares the `iosmac`
// variant's device families as `2:pad` and `6:mac` and defaults the setting to
// `"2"`, which is why a Catalyst build is a scaled iPad unless the target says
// otherwise. It is *not* `UIDesignRequiresCompatibility` — that key is the
// Liquid Glass opt-out, and setting it would opt Dexter out of the design
// system it is built on.
import {
  ConfigPlugin,
  withEntitlementsPlist,
  withPodfile,
  withXcodeProject,
} from "expo/config-plugins";

/** Build settings written onto the app target only.
 *
 * The keys are SDK-conditional so the iOS values stay byte-identical — a plain
 * `TARGETED_DEVICE_FAMILY = "1,2,6"` would also work for Catalyst but would
 * change what `eas build --platform ios` produces, and would race Expo's own
 * `IOSConfig.DeviceFamily.withDeviceFamily` mod.
 *
 * The `xcode` package stores bracketed keys and quoted values with their double
 * quotes as part of the JS string (`'"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'` is a
 * real key in this project), and its writer adds no quoting of its own — hence
 * the doubled quotes below. Bare identifiers like `SUPPORTS_MACCATALYST` take
 * bare values.
 */
const CATALYST_BUILD_SETTINGS: Record<string, string> = {
  SUPPORTS_MACCATALYST: "YES",
  // Keep `com.dexterplanner` rather than deriving `maccatalyst.com.dexterplanner`,
  // so the Mac build is the same app identity as iOS.
  DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER: "NO",
  '"TARGETED_DEVICE_FAMILY[sdk=macosx*]"': '"2,6"',
};

/** Strip the double quotes the `xcode` parser keeps as part of a value.
 *
 * `PRODUCT_NAME` arrives here as `"\"Dexter\""` mid-prebuild but settles to a
 * bare `Dexter` in the written pbxproj, so comparing against either form alone
 * is a trap.
 */
const unquote = (value: string | undefined): string | undefined =>
  value?.replace(/^"(.*)"$/, "$1");

const withCatalystXcodeProject: ConfigPlugin = (config) =>
  withXcodeProject(config, (xcodeConfig) => {
    const { projectName } = xcodeConfig.modRequest;
    if (!projectName)
      throw new Error("[withMacCatalyst] Missing iOS project name");

    // Same target-selection heuristic as Expo's own `setDeviceFamily`: a
    // build configuration with a `PRODUCT_NAME` is a *target's*, not the
    // project-level one. Narrowing further to our own product name keeps this
    // off any extension targets that may exist.
    //
    // The `xcode` package ships no type declarations, so the `XcodeProject`
    // that `modResults` is typed as resolves to an untyped value — the same
    // boundary `withAlarmSound.ts` documents. Nothing to narrow here.
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    const configurations: unknown =
      xcodeConfig.modResults.pbxXCBuildConfigurationSection();
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    let patched = 0;
    for (const entry of Object.values(
      (configurations ?? {}) as Record<
        string,
        { buildSettings?: Record<string, string> }
      >,
    )) {
      const buildSettings = entry?.buildSettings;
      if (!buildSettings) continue;
      if (unquote(buildSettings.PRODUCT_NAME) !== projectName) continue;

      Object.assign(buildSettings, CATALYST_BUILD_SETTINGS);
      patched += 1;
    }

    // Debug + Release. Zero means the pbxproj shape changed under us and the
    // whole POC would silently build as a plain iOS app.
    if (patched === 0) {
      throw new Error(
        `[withMacCatalyst] Found no build configurations for target "${projectName}"`,
      );
    }

    return xcodeConfig;
  });

/** Replace `find` in `contents` exactly once, or throw.
 *
 * The Podfile is generated from Expo's prebuild template, so these anchors are
 * hostage to it. Asserting is the only thing standing between a template bump
 * and a build that quietly isn't Catalyst at all.
 */
const replaceOnce = (
  contents: string,
  find: string,
  replace: string,
): string => {
  const occurrences = contents.split(find).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `[withMacCatalyst] Expected exactly 1 occurrence of ${JSON.stringify(find)} in the Podfile, found ${occurrences}. The Expo prebuild template likely changed.`,
    );
  }
  return contents.replace(find, replace);
};

// CocoaPods allows only one `post_install` hook per Podfile, so this has to be
// injected *inside* the existing block rather than appended as a second one.
const POD_TARGET_LOOP = `
    # DEX-85: make every pod target Catalyst-eligible. Mostly belt-and-braces —
    # \`SUPPORTS_MACCATALYST\` already defaults to YES for static libs, frameworks
    # and resource bundles; only application and app-extension product types
    # default it to NO. Cheap insurance against a pod that sets it explicitly.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SUPPORTS_MACCATALYST'] = 'YES'
      end
    end
    installer.pods_project.save
`;

const withCatalystPodfile: ConfigPlugin = (config) =>
  withPodfile(config, (podfileConfig) => {
    let contents = podfileConfig.modResults.contents;

    // `react-native-enriched-markdown` pulls RaTeX (a Rust LaTeX renderer) in
    // over SPM, and `RaTeX.xcframework` publishes `ios-arm64`, a simulator
    // slice and `macos-arm64_x86_64` — but no `maccatalyst`, so linking it
    // fails outright. The library documents this exact escape hatch, which
    // keeps the whole notes editor and drops only inline math rendering.
    //
    // Prepended rather than anchored: expo-router appends its own `ENV` line to
    // this file from a later mod, so there is no line reliably present at *our*
    // mod time. Order doesn't matter as long as this precedes podspec
    // evaluation, and nothing runs before the first line.
    contents =
      "# DEX-85: RaTeX ships no Mac Catalyst slice.\n" +
      "ENV['ENRICHED_MARKDOWN_ENABLE_MATH'] = '0'\n" +
      contents;

    // AlarmKit's *framework* is present in the Catalyst SDK slice, but every
    // symbol in it is `API_UNAVAILABLE(macCatalyst)` — 39 compile errors in
    // `expo-alarm-kit`, and no build setting fixes that. Drop the module from
    // autolinking; `metro.config.js` aliases the JS package to a no-op stub so
    // `utils/alarms.ios.ts` still imports cleanly. Macs have no alarm surface,
    // so nothing of value is lost on this platform.
    contents = replaceOnce(
      contents,
      "  use_expo_modules!\n",
      "  use_expo_modules!(exclude: ['expo-alarm-kit'])\n",
    );

    // React Native ships its own Catalyst path: `apply_mac_catalyst_patches`
    // (bundle code-signing, dead-code stripping, and the iOSSupport Swift
    // library search path). Expo's template wires it up and hardcodes it off.
    contents = replaceOnce(
      contents,
      ":mac_catalyst_enabled => false,",
      ":mac_catalyst_enabled => true,",
    );

    const anchor = `      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
`;
    contents = replaceOnce(contents, anchor, anchor + POD_TARGET_LOOP);

    podfileConfig.modResults.contents = contents;
    return podfileConfig;
  });

// On macOS an App Group identifier must be team-prefixed
// (`Q77C3BA452.group.com.dexterplanner`), which forces real provisioning and
// blocks the sign-to-run-locally flow this POC depends on. Dropping it is safe:
// `utils/alarms.ios.ts` already treats a failed `configure()` as a soft failure,
// and AlarmKit has no surface on macOS anyway.
const withoutAppGroup: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (entitlementsConfig) => {
    delete entitlementsConfig.modResults[
      "com.apple.security.application-groups"
    ];
    return entitlementsConfig;
  });

const withMacCatalyst: ConfigPlugin = (config) =>
  withoutAppGroup(withCatalystPodfile(withCatalystXcodeProject(config)));

export default withMacCatalyst;
