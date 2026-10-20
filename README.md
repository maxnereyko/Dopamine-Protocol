# Dopamine Protocol

**Decentralized Proof-of-Action Market for Human Discipline**

Dopamine Protocol turns personal discipline into a financial asset. Users stake capital on verifiable goals, doubters fund counter-pools, and AI + staked human validators verify execution. Winners claim the pool and mint MOTIV — an unbuyable Soulbound reputation token.

## Problem

- $500B+ self-improvement industry
- 90% of personal goals fail within weeks
- No accountability, no consequences, no verification

## Solution

A decentralized market where users bet on themselves:

1. **Stake & Challenge** — User commits to a verifiable goal and stakes capital
2. **Market Creation** — Doubters fund the counter-pool
3. **Proof Submission** — User submits encrypted video + biometric data
4. **Consensus & Payout** — AI + MOTIV-staked validators verify. Smart contracts execute.

## 3-Token Architecture

| Token | Function | Peg |
|---|---|---|
| **DOPE** | Stakes, prediction pools, prizes | 1:1 USDC |
| **TIME** | Services marketplace, mentorship | 1:1 USDC |
| **MOTIV** | Soulbound reputation (non-transferable) | Not for sale |

## Documentation

- [Core Architecture](docs/Core_Architecture.md)
- [Tokenomics](docs/Tokenomics.md)
- [Roadmap](docs/Roadmap.md)

## Tech Stack

- **Blockchain:** Solana
- **Smart Contracts:** Rust (Anchor Framework)
- **Token Standard:** SPL Token & Token-2022 (`NonTransferable` Soulbound standard for `MOTIV`)
- **Verification:** AI Oracles + Staked Validators
- **UI:** Web3Auth + Telegram Mini App

## Status

**Status:** Dual Pools + `MOTIV` minting logic deployed and tested on Solana Devnet (`Seeking pre-seed`).
- Creator stake + Doubter counter-pool settlement works on-chain (`src/lib.rs`).
- Winner receives 100% of the pool + 1 `MOTIV` reputation token.
- Automated test suite (`tests/anchor.test.ts`) and client verification script (`client/src/index.ts`) passing on Devnet.

## Smart Contract (Solana Devnet)

- **Program Name:** `dopamine_escrow`
- **Network:** Solana Devnet
- **Program ID:** `AUWtLgwXV2wxFoKRHo5NTiDW15q867ynR2Stky81JhT9`
- **Solana Explorer:** [View on Solana Explorer (Devnet)](https://explorer.solana.com/address/AUWtLgwXV2wxFoKRHo5NTiDW15q867ynR2Stky81JhT9?cluster=devnet)

## Contact

- **Email:** max@dopamineprotocol.io
- **LinkedIn:** https://www.linkedin.com/in/maksym-nereyko-0b7240434/
- **X:** https://x.com/Max_Dopamine
