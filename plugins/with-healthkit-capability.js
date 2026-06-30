const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const healthKitCapability = `						SystemCapabilities = {
							com.apple.HealthKit = {
								enabled = 1;
							};
						};
`;

function withHealthKitCapability(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = config.modRequest.projectName;
      const pbxprojPath = path.join(
        config.modRequest.platformProjectRoot,
        `${projectName}.xcodeproj`,
        'project.pbxproj'
      );

      if (!fs.existsSync(pbxprojPath)) {
        return config;
      }

      const pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
      if (pbxproj.includes('com.apple.HealthKit = {')) {
        return config;
      }

      const targetAttributesPattern =
        /(\t\t\t\tTargetAttributes = \{\n\t\t\t\t\t[0-9A-F]+ = \{\n(?:\t\t\t\t\t\t[^\n]+\n)*?\t\t\t\t\t\tLastSwiftMigration = [^;]+;\n)/;
      const updatedPbxproj = pbxproj.replace(targetAttributesPattern, `$1${healthKitCapability}`);

      if (updatedPbxproj !== pbxproj) {
        fs.writeFileSync(pbxprojPath, updatedPbxproj);
      }

      return config;
    },
  ]);
}

module.exports = withHealthKitCapability;
