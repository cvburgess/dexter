// DEX-72: bundle custom alarm sounds into the iOS app.
//
// AlarmKit's `AlertConfiguration.AlertSound.named(_:)` — what `expo-alarm-kit`'s
// `soundName` option maps to — resolves the filename against the *app bundle*,
// so a sound that only lives in `assets/` never rings. This project is fully
// CNG (`ios/` is generated and gitignored), and neither Expo nor the
// `expo-alarm-kit` podspec offers a way to declare a raw bundle resource, so
// prebuild has to do it: copy the file into the generated iOS project and add
// it to the app target's Copy Bundle Resources phase. This mirrors how
// `expo-notifications` handles its own `sounds` option upstream.
//
// Adding a sound is a one-line change to the `sounds` array in `app.json`; the
// matching entry in `ALARM_SOUNDS` (`utils/alarms.shared.ts`) is what makes it
// selectable. Because this touches the native project it needs a dev-client
// rebuild, not an OTA update.
import fs from "fs";
import path from "path";

import {
  ConfigPlugin,
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} from "expo/config-plugins";

type TAlarmSoundOptions = {
  /** Project-relative paths to the audio files to bundle. */
  sounds: string[];
};

/** `projectName` is optional on every mod's request but always present for iOS;
 * both mods below need it to address the app target's group. */
const requireProjectName = (projectName?: string): string => {
  if (!projectName)
    throw new Error("[withAlarmSound] Missing iOS project name");
  return projectName;
};

const withAlarmSound: ConfigPlugin<TAlarmSoundOptions> = (
  config,
  { sounds },
) => {
  // Copy each sound next to the generated Xcode project's sources, where
  // `addResourceFileToGroup` below expects to find it.
  const withCopiedSounds = withDangerousMod(config, [
    "ios",
    (dangerousConfig) => {
      const { platformProjectRoot, projectRoot } = dangerousConfig.modRequest;
      const projectName = requireProjectName(
        dangerousConfig.modRequest.projectName,
      );

      for (const sound of sounds) {
        const source = path.resolve(projectRoot, sound);
        if (!fs.existsSync(source)) {
          throw new Error(`[withAlarmSound] Sound not found: ${source}`);
        }
        fs.copyFileSync(
          source,
          path.join(platformProjectRoot, projectName, path.basename(sound)),
        );
      }

      return dangerousConfig;
    },
  ]);

  return withXcodeProject(withCopiedSounds, (xcodeConfig) => {
    const projectName = requireProjectName(xcodeConfig.modRequest.projectName);

    for (const sound of sounds) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.join(projectName, path.basename(sound)),
        groupName: projectName,
        isBuildFile: true,
        // The `xcode` package ships no type declarations, so the `XcodeProject`
        // that `modResults` is typed as resolves to an untyped value. Nothing to
        // narrow at this boundary.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        project: xcodeConfig.modResults,
      });
    }

    return xcodeConfig;
  });
};

export default withAlarmSound;
