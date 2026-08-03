// DEX-66: keep the generated ShareExtension's build number in step with the app.
//
// Apple rejects an upload whose app-extension `CFBundleVersion` differs from
// its containing app's ("The CFBundleVersion of an app extension must match
// that of its containing parent app"). `expo-share-intent` generates the
// ShareExtension target and its Info.plist at prebuild, before EAS resolves the
// remote build number (`appVersionSource: "remote"` with `autoIncrement` on the
// production profile), so the two are written at different moments and drift by
// construction — every production build would hit it.
//
// Rather than guess the number at prebuild time, this adds a Run Script phase
// to the app target that copies the app's own resolved `CFBundleVersion` onto
// the extension's plist at build time, when both are finally known.
import { ConfigPlugin, withXcodeProject } from "expo/config-plugins";

// `${SRCROOT}`/`${INFOPLIST_FILE}` are Xcode build settings, expanded by the
// shell Xcode runs this in — not template literals for TypeScript to fill in.
const SYNC_SCRIPT = `
SHARE_EXT_PLIST="\${SRCROOT}/ShareExtension/ShareExtension-Info.plist"

if [ -f "$SHARE_EXT_PLIST" ]; then
  # CURRENT_PROJECT_VERSION is the fallback: the app's plist carries the build
  # number for a normal build, but reads it from the setting under EAS.
  MAIN_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "\${INFOPLIST_FILE}" 2>/dev/null || echo "\${CURRENT_PROJECT_VERSION}")
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $MAIN_VERSION" "$SHARE_EXT_PLIST" 2>/dev/null || true
  echo "Synced ShareExtension CFBundleVersion to: $MAIN_VERSION"
fi
`;

const BUILD_PHASE_NAME = "Sync ShareExtension Version";

/**
 * The slice of the `xcode` project this plugin touches. Declared here because
 * the package ships no types of its own, which leaves `modResults` unresolvable
 * — narrowing it once beats an unsafe-access suppression on every line that
 * reads it.
 */
type TXcodeProject = {
  getFirstTarget: () => { uuid: string } | undefined;
  addBuildPhase: (
    files: string[],
    isa: string,
    comment: string,
    target: string,
    options: { shellPath: string; shellScript: string },
  ) => unknown;
  hash: {
    project: {
      objects: Record<string, Record<string, { name?: string }> | undefined>;
    };
  };
};

const withShareExtensionVersion: ConfigPlugin = (config) =>
  withXcodeProject(config, (xcodeConfig) => {
    const project = xcodeConfig.modResults as TXcodeProject;

    const mainAppTarget = project.getFirstTarget();
    if (!mainAppTarget) {
      throw new Error("[withShareExtensionVersion] Missing iOS app target");
    }

    // Prebuild can run against an already-generated project, and a second copy
    // of the phase would run the same script twice on every build.
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase;
    const alreadyAdded = Object.values(phases ?? {}).some(
      // Names round-trip through the pbxproj quoted.
      (phase) => phase.name?.replace(/"/g, "") === BUILD_PHASE_NAME,
    );
    if (alreadyAdded) return xcodeConfig;

    project.addBuildPhase(
      [],
      "PBXShellScriptBuildPhase",
      BUILD_PHASE_NAME,
      mainAppTarget.uuid,
      { shellPath: "/bin/sh", shellScript: SYNC_SCRIPT },
    );

    return xcodeConfig;
  });

export default withShareExtensionVersion;
