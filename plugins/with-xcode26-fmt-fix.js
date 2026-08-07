const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const marker = 'MMKVCore + Xcode 26 / iOS 26 SDK';

const fmtFix = `
    # =========================================================
    # FIX 1:
    # MMKVCore + Xcode 26 / iOS 26 SDK
    #
    # Error:
    # use of undeclared identifier 'memset_s'
    #
    # File:
    # Pods/MMKVCore/Core/aes/AESCrypt.cpp
    # =========================================================

    mmkv_aes_file = File.join(
      installer.sandbox.root.to_s,
      'MMKVCore',
      'Core',
      'aes',
      'AESCrypt.cpp'
    )

    if File.exist?(mmkv_aes_file)
      mmkv_content = File.read(mmkv_aes_file)
      old_condition = '#elif defined(__STDC_LIB_EXT1__) || defined(MMKV_APPLE)'
      new_condition = '#elif defined(__STDC_LIB_EXT1__)'

      if mmkv_content.include?(old_condition)
        mmkv_content = mmkv_content.gsub(old_condition, new_condition)
        File.write(mmkv_aes_file, mmkv_content)
      end
    end

    # =========================================================
    # FIX 2:
    # Xcode 26 + fmt
    #
    # Xcode 26 trips over fmt's C++20 consteval format-string path.
    # Keep this scoped only to fmt.
    # =========================================================

    installer.pods_project.targets.each do |target|
      next unless target.name.downcase == 'fmt'

      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
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
