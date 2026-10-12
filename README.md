# Hintville

A maths game for kids where the AI helper gives hints, never answers.

**Play now, no install, no account:** https://xelagate.github.io/agent-academy/

**Android APK for the Solana Seeker:** [Releases](https://github.com/Xelagate/agent-academy/releases) (latest v0.3.2)

## The problem

A child stuck on 2 + ? = 5 asks a chatbot, and the chatbot gives the answer. The child gets "3"
and learns no maths. Kids already do homework with AI, and open chatbots comply with "Just tell
me!".

Why now: schools and lawmakers want AI literacy. California SB 243 (chatbot rules for minors)
took effect in January 2026, and 37 states plus Puerto Rico publish AI-literacy guidance for
schools. Nothing teaches it to a small child.

## How Hintville works

The child does real maths. In the first level a friend is stuck at a broken river bridge; the
child fixes it with number planks (2 + ? = 5). When stuck, they tap a picture card to ask the
helper robot.

- **Ask clearly:** a clear question gets a clear hint.
- **Check the AI:** once per level the helper slips on purpose, and the child catches it.
- **Don't push:** "Just tell me!" gets a calm, easier step instead of the answer.

Fully voiced, captions on, works offline. No reading needed, so a pre-reader can play alone.

## Solana: for the grown-up, never the child

The Parents area is gated by a one-time Sign-In-With-Solana (`solana:signIn`) through Mobile
Wallet Adapter; on Seeker it goes through the Seed Vault wallet. No payment, no transaction. The
child never sees a wallet, a token or the word "crypto".

Next (not built yet): a soulbound learning badge on the parent's wallet for each finished level.

## Status

| | |
|---|---|
| Built | Solo, in about 4 weeks, during Solana Startup Terminal 2.0 (Superteam Ukraine) |
| Shipped | 5 releases in 15 days: v0.1.0 (27 Sep) → v0.3.2 (11 Oct) |
| Playable | 1 level (Fix the Bridge, "Adding to 5"); two more places on the map are locked |
| Users | 0 so far. Tested by a startup mentor (2 rounds), the Superteam Ukraine team, and family |
| Next | First families from the Solana community: Superteam and Colosseum parents, Seeker owners |

## Business model

Kids play free; parents pay $4.99/month (price in testing). Later: schools via AI-literacy
grants, studios licensing it with their own characters. There is no live AI model, so each
player costs close to nothing to run.

## Team

**Alex Pylypenko, founder (solo), Ukraine.** AI automation engineer at Peanut Trade, a crypto
market-making firm: I build LLM tools and Solana/EVM pipelines that handle real money. Built Hintville in about four weeks during Solana Startup Terminal 2.0 (Superteam
Ukraine).

Contact: [Telegram](https://t.me/GodsLikesMe)

## This repo

Holds the built page. The APK is built by `.github/workflows/apk.yml` with
`solana-mobile webshell`, which wraps the page in a native Android WebView.
