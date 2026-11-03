// Signs release builds with the developer's upload key, which Google Play requires (spec §8).
// `expo prebuild --clean` regenerates android/, so the signing setup lives here, not in a
// hand-edited build.gradle. The key and its passwords stay out of the repository: they are read
// from Gradle properties on the build machine (~/.gradle/gradle.properties). Without them, release
// builds keep using the debug key, as before.
const { withAppBuildGradle } = require('expo/config-plugins');

const PROPS = ['QUEAURA_UPLOAD_STORE_FILE', 'QUEAURA_UPLOAD_STORE_PASSWORD', 'QUEAURA_UPLOAD_KEY_ALIAS', 'QUEAURA_UPLOAD_KEY_PASSWORD'];
const MARK = '// queaura: release signing';

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(MARK)) return mod;
    const has = PROPS.map((p) => `project.hasProperty('${p}')`).join(' && ');
    const release = `
        ${MARK}
        release {
            if (${has}) {
                storeFile file(QUEAURA_UPLOAD_STORE_FILE)
                storePassword QUEAURA_UPLOAD_STORE_PASSWORD
                keyAlias QUEAURA_UPLOAD_KEY_ALIAS
                keyPassword QUEAURA_UPLOAD_KEY_PASSWORD
            }
        }`;
    if (!/signingConfigs\s*\{/.test(gradle)) throw new Error('withReleaseSigning: no signingConfigs block in android/app/build.gradle');
    gradle = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${release}`);
    // In the release build type, use the upload key when it's configured.
    const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseType.test(gradle)) throw new Error('withReleaseSigning: the release build type has no signingConfig line to replace');
    gradle = gradle.replace(releaseType, `$1signingConfig = (${has}) ? signingConfigs.release : signingConfigs.debug`);
    mod.modResults.contents = gradle;
    return mod;
  });
}

module.exports = withReleaseSigning;
