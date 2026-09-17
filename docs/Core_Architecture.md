# Core Architecture

Dopamine Protocol is a decentralized Proof-of-Action market built on Polygon.

## Three-Token Architecture

- **DOPE** (ERC-20, 1:1 USDC) — stakes, prediction pools, prizes
- **TIME** (ERC-20, 1:1 USDC) — services marketplace, mentorship
- **MOTIV** (ERC-5192 Soulbound) — reputation, governance, yields

## Core Mechanics

1. **Stake & Challenge** — User commits to a verifiable goal and stakes capital
2. **Market Creation** — Doubters fund the counter-pool
3. **Proof Submission** — User submits encrypted video + biometric data
4. **Consensus & Payout** — AI + MOTIV-staked validators verify. Smart contracts execute.

## Verification Stack

- **Layer 1:** Biometric & API integration (Chainlink Oracles, wearables, GPS)
- **Layer 2:** AI computer vision for video/photo proof
- **Layer 3:** MOTIV-staked human validators for edge cases

## Tech Stack

- **Blockchain:** Polygon PoS (EVM)
- **Smart Contracts:** Solidity, Gnosis Safe multisig
- **Oracles:** Chainlink
- **UI:** Web3Auth + Telegram Mini App
