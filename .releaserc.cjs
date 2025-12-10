module.exports = {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', {
      changelogFile: 'CHANGELOG.md',
    }],
    ["@semantic-release/npm", {
      npmPublish: false,
    }],
    ['@semantic-release/exec', {
      prepareCmd: 'npm run deploy && npm run test-postdeploy',
      publishCmd: 'npm run deploy-routes'
    }],
    ['@adobe/semantic-release-coralogix', {
      iconUrl: 'https://www.aem.live/media_13916754ab1f54a7a0b88dcb62cf6902d58148b1c.png',
      applications: ['helix-services']
    }],
    ['@semantic-release/git', {
      assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }],
    ['@semantic-release/github', {
      assets: [
        { path: 'dist/**/*.zip', label: 'Helix HTML2MD Bundle' }
      ]
    }],
  ],
  branches: ['main'],
};
