# Agent Academy

Kids aged 7–9 teach a small creature to solve cases, and in doing so learn how AI agents
think: tools, memory, rules. Built for Seeker (Solana Mobile). A parent signs in once with
their wallet; the child never sees a wallet.

- Play in a browser: https://xelagate.github.io/agent-academy/
- Android APK: see Releases, or the `APK` workflow artifacts.

This repo holds the built page. The APK is built by `.github/workflows/apk.yml` with
`solana-mobile webshell`, which wraps the page in a native Android WebView.
