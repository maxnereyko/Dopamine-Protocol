# Core Architecture

Dopamine Protocol is a decentralized Proof-of-Action market built on Solana.

## Three-Token Architecture

- **DOPE (Solana SPL Token, 1:1 USDC)** — stakes, prediction pools, prizes
- **TIME (Solana SPL Token, 1:1 USDC)** — services marketplace, mentorship
- **MOTIV (Solana Token-2022 NonTransferable)** — reputation, governance, yields (Soulbound)

## Core Mechanics

1. **Stake & Challenge** — User commits to a verifiable goal and stakes capital
2. **Market Creation** — Doubters fund the counter-pool
3. **Proof Submission** — User submits encrypted video + biometric data
4. **Consensus & Payout** — AI + MOTIV-staked validators verify. Smart contracts execute.

## Verification Stack

- **Layer 1:** Biometric & API integration (Oracles, wearables, GPS)
- **Layer 2:** AI computer vision for video/photo proof
- **Layer 3:** MOTIV-staked human validators for edge cases

## Tech Stack

- **Blockchain:** Solana
- **Smart Contracts:** Rust (Anchor Framework)
- **Token Standard:** SPL Token & Token-2022 (`NonTransferable` extension for Soulbound `MOTIV`)
- **Verification:** AI Oracles + Staked Validators
- **UI:** Web3Auth + Telegram Mini App
