module.exports = {
  appId: 'app.planyournet.desktop',
  productName: 'Plan Your Net',
  directories: { output: 'release', buildResources: 'dist-electron' },
  icon: 'icon.ico',
  files: [
    'dist-electron/**/*',
    'package.json',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    '!**/*.map',
    '!node_modules/**/*',
  ],
  extraFiles: [
    { from: 'LICENSE', to: 'LICENSE.txt' },
    { from: 'THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.md' },
  ],
  asar: true,
  npmRebuild: false,
  win: {
    target: [{ target: 'portable', arch: ['x64'] }],
    artifactName: 'Plan-Your-Net-${version}-${arch}.${ext}',
    executableName: 'PlanYourNet',
    icon: 'icon.ico',
    signAndEditExecutable: true,
    signExecutable: false,
  },
};
