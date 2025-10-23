# EncryptedTreasure-Dive Game Scenario

EncryptedTreasure-Dive is an on-chain treasure hunting mini-game where players explore underwater treasure boxes through encrypted random numbers, ensuring a fair and unpredictable experience.

## Core Gameplay
- Each dive calls `FHE.randEuint16` to generate routes, combined with CAMM RNG from Chapter 20 of the documentation to prevent manipulation.
- Treasure box rewards use `euint32` to store value ranges, distributing rewards based on player equipment through `FHE.select`.
- Implements `Obfuscated Reserves` to hide remaining pool amounts, preventing players from inferring remaining treasures.

## System Components
- `dive-client`: Web frontend for rendering views and caching player progress handles.
- `game-contracts/TreasureCore`: Handles random number generation and reward settlement.
- `game-contracts/TreasurePolicyManager`: Maintains dive parameters and reward ranges for core contract queries.
- `game-contracts/TreasureLeaderboard`: Accumulates encrypted rewards and tracks homomorphic scores per player.
- `game-contracts/TreasureAccessController`: Centrally manages divemaster and module authorizations.
- `analytics/gateway-worker`: Generates aggregated statistics for event organizers (weekly active users, drop rates).

## Development Tasks
- Build multiplayer competition mode with batch processing for daily leaderboards.
- Add anti-cheat detection using off-chain attestation to verify player devices.
