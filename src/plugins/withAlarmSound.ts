// DEX-72: AlarmKit resolves soundName against the app bundle, so this copies
// a sound into the generated iOS project and adds it to Copy Bundle Resources.
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

/** Optional on every mod's request but always present for iOS. */
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
        // The `xcode` package ships no type declarations; nothing to narrow.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        project: xcodeConfig.modResults,
      });
    }

    return xcodeConfig;
  });
};

export default withAlarmSound;
