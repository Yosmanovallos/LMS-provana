# CI setup

`github-actions-ci.yml` is the GitHub Actions workflow (install → lint → test → build).

It lives here instead of `.github/workflows/` because the push token used to create this
repo lacked the `workflow` scope. To enable CI:

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions"
git push   # requires a token/credential with workflow scope
```
