const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const marker = 'Xcode 26 trips over fmt 11';

const fmtFix = `
    # Xcode 26 trips over fmt 11's C++20 consteval format-string path.
    # Keep this scoped to fmt so React Native pods retain their C++20 setting.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'

      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

function withXcode26FmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      const podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes(marker)) {
        return config;
      }

      const updatedPodfile = podfile.replace(
        /(    react_native_post_install\([\s\S]*?\n    \)\n)/,
        `$1${fmtFix}`
      );

      if (updatedPodfile !== podfile) {
        fs.writeFileSync(podfilePath, updatedPodfile);
      }

      return config;
    },
  ]);
}

module.exports = withXcode26FmtFix;
