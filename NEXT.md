# Test channel

- Source: production 1.0.26, commit e8423f0b7b0ed34dae99162eaa481b7c4feb9e44.
- Repository: yyzz97/lolping-owlbear-test. Only push this test checkout to its test remote.
- Manifest: https://yyzz97.github.io/lolping-owlbear-test/manifest.json.
- Test version: 1.0.27-beta.1; new 100% volume equals 80% of production 1.0.26.
- New settings: 0–120% volume with a small snap near 100%; block all other senders or selected users; local persistent preferences.
- Keep the production repository, deployment workflow and manifest unchanged.
- Run npm test, npm run check and npm run build before pushing. Mock and browser fixture results do not replace live Owlbear two-client acceptance.
