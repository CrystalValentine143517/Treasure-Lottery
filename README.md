# Treasure Lottery

<div align="center">
  <img src="frontend/src/assets/chest-closed.png" alt="Treasure Lottery" width="180"/>

  **Privacy-Preserving Q&A Treasure Hunt Game**

  Built with Zama fhEVM v0.9.1 | Fully Homomorphic Encryption on Ethereum

  [![Live Demo](https://img.shields.io/badge/Live-treasurelottery.vercel.app-0066FF?style=flat-square)](https://treasurelottery.vercel.app)
  [![Sepolia](https://img.shields.io/badge/Network-Sepolia-6B7280?style=flat-square)](https://sepolia.etherscan.io/address/0x8B4C4682EE9832FFeFAc0d38b2422A8Fa6a4115d)
  [![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
</div>

---

## Overview

Treasure Lottery is a decentralized quiz game demonstrating practical applications of Fully Homomorphic Encryption (FHE) in blockchain gaming. Players answer encrypted questions to unlock treasure chests, with answer verification performed entirely on encrypted data—ensuring correct answers are never exposed on-chain.

### Key Innovation

Unlike traditional blockchain games where answers must be hashed or revealed, this implementation uses **homomorphic comparison** to verify answers while both the correct answer and player submission remain encrypted throughout the entire lifecycle.

---

## Table of Contents

- [Game Mechanics](#game-mechanics)
- [Technical Architecture](#technical-architecture)
- [FHE Implementation](#fhe-implementation)
- [Smart Contract Design](#smart-contract-design)
- [Project Structure](#project-structure)
- [Dependencies](#dependencies)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Testing](#testing)
- [API Reference](#api-reference)

---

## Game Mechanics

### Gameplay Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Connect Wallet │────▶│  Get Random Q    │────▶│  Submit Answer  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │  Claim Result    │◀─────────────┘
                        │  (KMS Decrypt)   │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
    ┌─────────────────┐                   ┌─────────────────┐
    │  Correct: +100  │                   │  Wrong: Retry   │
    │  Chest Opens!   │                   │  (if attempts)  │
    └─────────────────┘                   └─────────────────┘
```

### Rules

| Parameter | Value | Description |
|-----------|-------|-------------|
| Daily Attempts | 3 | Maximum attempts per wallet per day |
| Reset Cycle | 24 hours | UTC-based daily reset |
| Base Reward | 100 coins | Standard question reward |
| Bonus Reward | 200-300 coins | Difficult question multiplier |
| Question Pool | 8 questions | Initial deployment |

### Question Bank

| ID | Category | Difficulty | Reward |
|----|----------|------------|--------|
| 0-2 | Arithmetic | Easy | 100 |
| 3-5 | General Knowledge | Easy | 100 |
| 6 | Mathematics | Medium | 200 |
| 7 | Pop Culture | Hard | 300 |

---

## Technical Architecture

### System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ RainbowKit  │  │ Wagmi v2    │  │ Zama Relayer SDK        │  │
│  │ (Wallet UI) │  │ (Hooks)     │  │ (FHE Encryption)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Ethereum Sepolia                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              QuestionTreasureBox.sol                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ FHE.asEuint32│  │ FHE.eq()     │  │ FHE.checkSigs()  │  │  │
│  │  │ (Encrypt)    │  │ (Compare)    │  │ (Verify KMS)     │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Zama KMS Infrastructure                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Key Management Service | Threshold Decryption | Signatures │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow: Encrypted Answer Submission

```
1. Frontend: encryptAnswer(userAnswer) via Relayer SDK
   └─▶ Returns: { handle: bytes32, proof: bytes }

2. Contract: submitEncryptedAnswer(questionId, handle, proof)
   └─▶ FHE.fromExternal(handle, proof) → euint32
   └─▶ FHE.eq(userAnswer, correctAnswer) → ebool
   └─▶ FHE.makePubliclyDecryptable(result)
   └─▶ Store PendingAnswer { player, questionId, encryptedResult }

3. Frontend: publicDecrypt([resultHandle]) via Relayer SDK
   └─▶ KMS performs threshold decryption
   └─▶ Returns: { clearValues, decryptionProof }

4. Contract: claimResult(pendingAnswerId, decryptedResult, proof)
   └─▶ FHE.checkSignatures(handles, encodedResult, proof)
   └─▶ If valid && result==true: unlock treasure
```

---

## FHE Implementation

### Core FHE Operations

#### 1. Answer Encryption (On-Chain)
```solidity
// Store encrypted answer during question creation
euint32 encryptedAnswer = FHE.asEuint32(answer);
FHE.allowThis(encryptedAnswer);
```

#### 2. Encrypted Input Processing (User Submission)
```solidity
// Convert external encrypted input to internal euint32
euint32 userEncryptedAnswer = FHE.fromExternal(encryptedAnswer, inputProof);
FHE.allowThis(userEncryptedAnswer);
```

#### 3. Homomorphic Comparison
```solidity
// Compare two encrypted values without decryption
ebool isCorrect = FHE.eq(userEncryptedAnswer, question.encryptedAnswer);
FHE.allowThis(isCorrect);
FHE.makePubliclyDecryptable(isCorrect);
```

#### 4. KMS Signature Verification
```solidity
// Verify decryption proof from KMS
bytes32[] memory handles = new bytes32[](1);
handles[0] = FHE.toBytes32(pending.encryptedResult);
bytes memory abiEncodedResult = abi.encode(decryptedResult);
FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);
```

### Frontend FHE Integration

```typescript
// Initialize FHE instance
const sdk = window.RelayerSDK;
const { initSDK, createInstance, SepoliaConfig } = sdk;
await initSDK();
const fheInstance = await createInstance({ ...SepoliaConfig, network: provider });

// Encrypt answer before submission
const input = fheInstance.createEncryptedInput(contractAddr, userAddr);
input.add32(answer);
const { handles, inputProof } = await input.encrypt();

// Request public decryption
const results = await fheInstance.publicDecrypt([handle]);
const clearValue = results.clearValues[handle];
const decryptionProof = results.decryptionProof;
```

### Security Guarantees

| Property | Mechanism |
|----------|-----------|
| Answer Confidentiality | Answers stored as `euint32`, never decrypted on-chain |
| Input Privacy | User answers encrypted client-side before submission |
| Verification Integrity | Homomorphic `FHE.eq()` comparison on encrypted data |
| Decryption Authenticity | KMS threshold signatures verified via `FHE.checkSignatures()` |

---

## Smart Contract Design

### Contract: QuestionTreasureBox.sol

**Inheritance**: `ZamaEthereumConfig`

### State Variables

```solidity
struct Question {
    string questionText;
    euint32 encryptedAnswer;  // FHE encrypted
    uint64 reward;
    bool isActive;
    uint256 createdAt;
}

struct DailyProgress {
    uint256 lastResetDay;
    uint8 attemptsToday;
    uint256 totalSolved;
    uint64 totalRewards;
}

struct PendingAnswer {
    address player;
    uint256 questionId;
    ebool encryptedResult;  // FHE encrypted comparison result
    uint256 timestamp;
    bool processed;
}
```

### Core Functions

| Function | Access | Description |
|----------|--------|-------------|
| `submitEncryptedAnswer` | External | Submit FHE-encrypted answer |
| `claimResult` | External | Verify KMS proof and claim reward |
| `answerQuestion` | External | Demo mode (on-chain encryption) |
| `createQuestion` | External | Add new question to pool |
| `getPlayerProgress` | View | Query player stats |
| `getRandomQuestion` | View | Get unsolved question for player |

### Events

```solidity
event AnswerSubmitted(address indexed player, uint256 indexed questionId,
                      uint256 pendingAnswerId, bytes32 encryptedResultHandle);
event TreasureUnlocked(address indexed player, uint256 indexed questionId, uint64 reward);
event AnswerWrong(address indexed player, uint256 indexed questionId);
event DailyLimitReset(address indexed player, uint256 newDay);
```

### Custom Errors

```solidity
error DailyLimitReached(uint8 attemptsUsed, uint256 resetsIn);
error AlreadySolved(uint256 questionId);
error QuestionNotActive(uint256 questionId);
error InvalidQuestionId();
error NoPendingAnswer();
error AnswerAlreadyProcessed();
error InvalidDecryptionProof();
```

---

## Project Structure

```
TreasureLottery/
├── contracts/
│   ├── QuestionTreasureBox.sol      # Main FHE game contract
│   ├── QuestionTreasureBoxTest.sol  # Non-FHE test variant
│   ├── ChallengeTreasureBox.sol     # Challenge mode variant
│   └── SimpleTreasureBoxV2.sol      # Simplified version
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── TreasureChest.tsx    # Main game UI
│   │   ├── config/
│   │   │   └── contract.ts          # ABI & address
│   │   ├── lib/
│   │   │   └── fhe.ts               # FHE SDK wrapper
│   │   └── pages/
│   │       └── Home.tsx             # Landing page
│   └── package.json
├── scripts/
│   ├── deploy.js                    # Deployment script
│   ├── create-questions.js          # Initialize questions
│   └── check-player.js              # Debug utilities
├── test/
│   ├── QuestionTreasureBox.test.js      # Non-FHE unit tests
│   └── QuestionTreasureBox.fhe.test.js  # FHE unit tests
├── hardhat.config.js
└── package.json
```

---

## Dependencies

### Smart Contract Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@fhevm/solidity` | ^0.9.1 | Zama FHE library for Solidity |
| `@fhevm/hardhat-plugin` | ^0.3.0-1 | Hardhat FHE testing support |
| `hardhat` | ^2.22.0 | Development framework |
| `@nomicfoundation/hardhat-toolbox` | ^5.0.0 | Testing utilities |

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `viem` | ^2.38.3 | Ethereum client |
| `wagmi` | ^2.18.2 | React hooks for Ethereum |
| `@rainbow-me/rainbowkit` | ^2.2.9 | Wallet connection UI |
| `@tanstack/react-query` | ^5.83.0 | Async state management |
| `framer-motion` | ^12.23.24 | Animations |
| `tailwindcss` | ^3.4.17 | Styling |
| `typescript` | ^5.8.3 | Type safety |
| `vite` | ^5.4.19 | Build tool |

### External Services

| Service | Purpose |
|---------|---------|
| Zama Relayer SDK (CDN) | Client-side FHE encryption |
| Zama KMS | Threshold decryption service |
| Sepolia RPC | Ethereum testnet |

---

## Deployment

### Contract Deployment

**Network**: Ethereum Sepolia Testnet
**Contract Address**: `0x8B4C4682EE9832FFeFAc0d38b2422A8Fa6a4115d`
**Explorer**: [View on Etherscan](https://sepolia.etherscan.io/address/0x8B4C4682EE9832FFeFAc0d38b2422A8Fa6a4115d)

### Frontend Deployment

**Platform**: Vercel
**URL**: [treasurelottery.vercel.app](https://treasurelottery.vercel.app)
**Build**: Automatic on main branch push

---

## Local Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MetaMask or compatible wallet
- Sepolia testnet ETH ([Faucet](https://sepoliafaucet.com))

### Setup

```bash
# Clone repository
git clone https://github.com/CrystalValentine143517/Treasure-Lottery.git
cd Treasure-Lottery

# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Environment Configuration

```bash
# Root .env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
```

### Development Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Deploy to Sepolia
npm run deploy

# Start frontend dev server
cd frontend && npm run dev
```

---

## Testing

### Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| `QuestionTreasureBox.test.js` | 30 | Non-FHE functional tests |
| `QuestionTreasureBox.fhe.test.js` | 28 | FHE mock environment tests |

### Run Tests

```bash
# Run all tests
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com" npx hardhat test

# Run FHE tests only
npx hardhat test test/QuestionTreasureBox.fhe.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### FHE Test Coverage

- Encrypted answer submission
- Daily limit enforcement with FHE
- Multi-player encrypted submissions
- Pending answer management
- Edge cases (zero, max uint32)

---

## API Reference

### Frontend FHE Library (`lib/fhe.ts`)

```typescript
// Initialize FHE SDK
initializeFHE(provider?: any): Promise<FHEInstance>

// Encrypt answer for submission
encryptAnswer(userAddress: Address, answer: number, provider?: any): Promise<{
  handle: `0x${string}`;
  proof: `0x${string}`;
}>

// Request public decryption from KMS
requestDecryption(handle: `0x${string}`, provider?: any): Promise<{
  decryptedResult: boolean;
  decryptionProof: `0x${string}`;
}>

// Request decryption with retry
requestDecryptionWithRetry(
  handle: `0x${string}`,
  maxRetries?: number,
  retryDelayMs?: number,
  provider?: any
): Promise<{ decryptedResult: boolean; decryptionProof: `0x${string}` }>

// Status utilities
isFHEReady(): boolean
waitForFHE(timeoutMs?: number): Promise<boolean>
getFHEStatus(): { sdkLoaded: boolean; instanceReady: boolean }
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Zama](https://www.zama.ai/) - fhEVM and FHE infrastructure
- [RainbowKit](https://www.rainbowkit.com/) - Wallet connection
- [Wagmi](https://wagmi.sh/) - React hooks for Ethereum

---

<div align="center">

  **Built with Zama fhEVM v0.9.1**

  [Documentation](https://docs.zama.ai) | [Discord](https://discord.gg/zama) | [GitHub](https://github.com/zama-ai)

</div>
