// DEX-85: Catalyst-ify the generated (CNG) iOS project. "Optimize Interface
// for Mac" is TARGETED_DEVICE_FAMILY containing 6 — not UIDesignRequiresCompatibility (the Liquid Glass opt-out).
import {
  ConfigPlugin,
  withEntitlementsPlist,
  withPodfile,
  withXcodeProject,
} from "expo/config-plugins";

// SDK-conditional keys keep iOS builds byte-identical and avoid racing Expo's
// withDeviceFamily mod; doubled quotes because `xcode` stores them as-is.
const CATALYST_BUILD_SETTINGS: Record<string, string> = {
  SUPPORTS_MACCATALYST: "YES",
  // Keep `com.dexterplanner` rather than deriving `maccatalyst.com.dexterplanner`,
  // so the Mac build is the same app identity as iOS.
  DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER: "NO",
  '"TARGETED_DEVICE_FAMILY[sdk=macosx*]"': '"2,6"',
};

// PRODUCT_NAME is quoted mid-prebuild but bare in the written pbxproj, so
// comparing against either form alone is a trap.
const unquote = (value: string | undefined): string | undefined =>
  value?.replace(/^"(.*)"$/, "$1");

const withCatalystXcodeProject: ConfigPlugin = (config) =>
  withXcodeProject(config, (xcodeConfig) => {
    const { projectName } = xcodeConfig.modRequest;
    if (!projectName)
      throw new Error("[withMacCatalyst] Missing iOS project name");

    // A configuration with PRODUCT_NAME is a target's, not the project's
    // (Expo's setDeviceFamily heuristic); matching ours skips extensions.
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

// Anchors are hostage to Expo's Podfile template; asserting the match count is
// what stands between a template bump and a build that quietly isn't Catalyst.
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
    # DEX-85: cheap insurance — only app/app-extension product types default
    # SUPPORTS_MACCATALYST to NO, but a pod may set it explicitly.
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

    // RaTeX ships no maccatalyst slice; this documented escape hatch keeps
    // the notes editor and drops only inline math. Prepended: no anchor is reliable here.
    contents =
      "# DEX-85: RaTeX ships no Mac Catalyst slice.\n" +
      "ENV['ENRICHED_MARKDOWN_ENABLE_MATH'] = '0'\n" +
      contents;

    // Every AlarmKit symbol is API_UNAVAILABLE(macCatalyst) — drop the module
    // from autolinking; metro.config.js aliases the JS package to a stub.
    contents = replaceOnce(
      contents,
      "  use_expo_modules!\n",
      "  use_expo_modules!(exclude: ['expo-alarm-kit'])\n",
    );

    // RN ships its own Catalyst path (`apply_mac_catalyst_patches`); Expo's
    // template wires it up and hardcodes it off.
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

// A macOS App Group must be team-prefixed, forcing real provisioning; safe to
// drop — alarms.ios.ts treats a failed configure() as soft.
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
