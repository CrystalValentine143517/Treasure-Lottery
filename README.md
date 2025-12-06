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

## Table of Contents

- [Project Overview](#project-overview)
- [Core Innovation](#core-innovation)
- [Gameplay Guide](#gameplay-guide)
- [Technical Architecture](#technical-architecture)
- [Smart Contract Design](#smart-contract-design)
- [FHE Operations Deep Dive](#fhe-operations-deep-dive)
- [Project Structure](#project-structure)
- [Dependencies](#dependencies)
- [Local Development](#local-development)
- [Unit Testing](#unit-testing)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## Project Overview

Treasure Lottery is a decentralized quiz game that demonstrates practical applications of Fully Homomorphic Encryption (FHE) in blockchain gaming. Players answer encrypted questions to unlock virtual treasure chests, with answer verification performed entirely on encrypted data—ensuring correct answers are never exposed on-chain.

### What Makes This Unique

In traditional blockchain games, answer verification requires one of these approaches:

| Approach | Privacy | Trust | Problem |
|----------|---------|-------|---------|
| Plaintext comparison | None | On-chain | Answers visible in contract storage |
| Hash comparison | Partial | On-chain | Vulnerable to rainbow table attacks |
| Commit-reveal | Medium | Time-based | Complex UX, timing attacks |
| **FHE (This Project)** | **Full** | **Cryptographic** | **None - answers never revealed** |

This implementation uses **homomorphic comparison** to verify answers while both the correct answer and player submission remain encrypted throughout the entire lifecycle.

---

## Core Innovation

### How FHE Answer Verification Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Traditional Answer Verification                      │
├─────────────────────────────────────────────────────────────────────────┤
│  User Answer: 42  ──▶  Contract: if(42 == storedAnswer) ──▶  Exposed!   │
│                        storedAnswer is readable on-chain                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      FHE Answer Verification (Ours)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  E(42) ──▶  Contract: FHE.eq(E(42), E(storedAnswer)) ──▶ E(true/false) │
│             Both values remain encrypted - zero knowledge exposed        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Privacy Guarantees

| Property | Mechanism | Verification |
|----------|-----------|--------------|
| **Answer Confidentiality** | Correct answers stored as `euint32` | Never decrypted on-chain |
| **Input Privacy** | User answers encrypted client-side via Relayer SDK | Only ciphertext transmitted |
| **Verification Integrity** | `FHE.eq()` homomorphic comparison | Result is also encrypted |
| **Decryption Authenticity** | KMS threshold signatures | `FHE.checkSignatures()` verification |

---

## Gameplay Guide

### Game Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Connect Wallet │────▶│  Get Random Q    │────▶│  Submit Answer  │
│  (RainbowKit)   │     │  getRandomQuestion│    │  (FHE Encrypted)│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Claim Result    │◀────│  KMS Decryption │
                        │  claimResult()   │     │  publicDecrypt()│
                        └────────┬─────────┘     └─────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
    ┌─────────────────┐                   ┌─────────────────┐
    │  Correct: +100  │                   │  Wrong: Retry   │
    │  Chest Opens!   │                   │  (if attempts)  │
    └─────────────────┘                   └─────────────────┘
```

### Game Rules

| Parameter | Value | Description |
|-----------|-------|-------------|
| Daily Attempts | 3 | Maximum attempts per wallet per day |
| Reset Cycle | 24 hours | UTC-based daily reset |
| Base Reward | 100 coins | Standard question reward |
| Medium Bonus | 200 coins | Medium difficulty multiplier |
| Hard Bonus | 300 coins | Hard difficulty multiplier |
| Question Pool | 8 questions | Initial deployment |

### Question Bank

| ID | Question | Difficulty | Reward | Answer Type |
|----|----------|------------|--------|-------------|
| 0 | What is 5 + 7? | Easy | 100 | Arithmetic |
| 1 | What is 15 - 8? | Easy | 100 | Arithmetic |
| 2 | What is 6 * 4? | Easy | 100 | Arithmetic |
| 3 | How many days in a week? | Easy | 100 | General Knowledge |
| 4 | How many months in a year? | Easy | 100 | General Knowledge |
| 5 | How many sides does a hexagon have? | Easy | 100 | Geometry |
| 6 | What is 10 squared (10^2)? | Medium | 200 | Mathematics |
| 7 | The answer to life, universe, and everything? | Hard | 300 | Pop Culture |

---

## Technical Architecture

### System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ RainbowKit  │  │ Wagmi v2    │  │ Zama Relayer SDK        │  │
│  │ (Wallet UI) │  │ (Hooks)     │  │ (FHE Encryption)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                         │                     │                   │
│  ┌─────────────────────┴─────────────────────┴───────────────┐  │
│  │                    lib/fhe.ts                              │  │
│  │  initializeFHE() | encryptAnswer() | requestDecryption()   │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ JSON-RPC / SDK Calls
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Ethereum Sepolia Testnet                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              QuestionTreasureBox.sol (Main Contract)       │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ FHE Operations:                                       │  │  │
│  │  │ • FHE.asEuint32() - On-chain encryption               │  │  │
│  │  │ • FHE.fromExternal() - External input processing      │  │  │
│  │  │ • FHE.eq() - Homomorphic equality comparison          │  │  │
│  │  │ • FHE.allowThis() - ACL permission grant              │  │  │
│  │  │ • FHE.makePubliclyDecryptable() - KMS decryption prep │  │  │
│  │  │ • FHE.checkSignatures() - KMS proof verification      │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Decryption Requests
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Zama KMS Infrastructure                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Key Management Service | Threshold Decryption | Signatures │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow: Complete Answer Submission Lifecycle

```
Phase 1: Client-Side Encryption
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend: encryptAnswer(userAddress, answer, provider)
  ├─▶ Initialize FHE instance via Relayer SDK
  ├─▶ createEncryptedInput(contractAddr, userAddr)
  ├─▶ input.add32(answer)
  └─▶ input.encrypt() ──▶ Returns: { handles: [bytes32], inputProof: bytes }

Phase 2: On-Chain FHE Processing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contract: submitEncryptedAnswer(questionId, handle, inputProof)
  ├─▶ FHE.fromExternal(handle, inputProof) ──▶ euint32 userAnswer
  ├─▶ FHE.allowThis(userAnswer)
  ├─▶ FHE.eq(userAnswer, question.encryptedAnswer) ──▶ ebool isCorrect
  ├─▶ FHE.allowThis(isCorrect)
  ├─▶ FHE.makePubliclyDecryptable(isCorrect)
  └─▶ Store PendingAnswer { player, questionId, encryptedResult, timestamp }

Phase 3: KMS Decryption
━━━━━━━━━━━━━━━━━━━━━━━
Frontend: requestDecryption(resultHandle, provider)
  ├─▶ fheInstance.publicDecrypt([handle])
  ├─▶ KMS performs threshold decryption
  └─▶ Returns: { clearValues: Map, decryptionProof: bytes }

Phase 4: Result Verification & Reward
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contract: claimResult(pendingAnswerId, decryptedResult, decryptionProof)
  ├─▶ FHE.checkSignatures(handlesList, abiEncodedResult, decryptionProof)
  ├─▶ If signatures valid && result == true:
  │     ├─▶ progress.totalSolved++
  │     ├─▶ progress.totalRewards += question.reward
  │     ├─▶ hasSolved[player][questionId] = true
  │     └─▶ emit TreasureUnlocked(player, questionId, reward)
  └─▶ Else: emit AnswerWrong(player, questionId)
```

---

## Smart Contract Design

### Contract: QuestionTreasureBox.sol

**Compiler**: Solidity ^0.8.24
**Inheritance**: `ZamaEthereumConfig` (fhEVM v0.9.1)
**Network**: Ethereum Sepolia Testnet

### State Structures

```solidity
struct Question {
    string questionText;       // Plaintext question (public)
    euint32 encryptedAnswer;   // FHE-encrypted correct answer
    uint64 reward;             // Reward amount (plaintext)
    bool isActive;             // Question availability flag
    uint256 createdAt;         // Creation timestamp
}

struct DailyProgress {
    uint256 lastResetDay;      // Day number for reset tracking
    uint8 attemptsToday;       // Daily attempt counter (max 3)
    uint256 totalSolved;       // Lifetime solved count
    uint64 totalRewards;       // Lifetime rewards accumulated
}

struct PendingAnswer {
    address player;            // Player who submitted
    uint256 questionId;        // Question being answered
    ebool encryptedResult;     // FHE-encrypted comparison result
    uint256 timestamp;         // Submission time
    bool processed;            // Claim status
}
```

### Storage Mappings

```solidity
mapping(uint256 => Question) public questions;              // questionId => Question
mapping(address => DailyProgress) public playerProgress;    // player => progress
mapping(address => mapping(uint256 => bool)) public hasSolved; // player => questionId => solved
mapping(uint256 => PendingAnswer) public pendingAnswers;    // pendingId => PendingAnswer
mapping(address => uint256) public playerPendingAnswer;     // player => latest pending ID
```

### Core Functions

| Function | Access | Gas Estimate | Description |
|----------|--------|--------------|-------------|
| `createQuestion(text, answer, reward)` | External | ~180,000 | Create new question with FHE-encrypted answer |
| `submitEncryptedAnswer(qId, handle, proof)` | External | ~350,000 | Submit FHE-encrypted answer for verification |
| `claimResult(pendingId, result, proof)` | External | ~150,000 | Verify KMS proof and claim reward |
| `answerQuestion(qId, answer)` | External | ~320,000 | Demo mode: on-chain encryption |
| `getPlayerProgress(player)` | View | ~30,000 | Query player statistics |
| `getRandomQuestion(player)` | View | ~50,000 | Get unsolved question for player |
| `getPendingAnswer(pendingId)` | View | ~25,000 | Get pending answer details |

### Events

```solidity
event QuestionCreated(uint256 indexed questionId, string questionText, uint64 reward);
event AnswerSubmitted(address indexed player, uint256 indexed questionId,
                      uint256 pendingAnswerId, bytes32 encryptedResultHandle);
event TreasureUnlocked(address indexed player, uint256 indexed questionId, uint64 reward);
event AnswerWrong(address indexed player, uint256 indexed questionId);
event DailyLimitReset(address indexed player, uint256 newDay);
```

### Custom Errors

```solidity
error DailyLimitReached(uint8 attemptsUsed, uint256 resetsIn);
error QuestionNotActive(uint256 questionId);
error InvalidQuestionId();
error AlreadySolved(uint256 questionId);
error NoPendingAnswer();
error AnswerAlreadyProcessed();
error InvalidDecryptionProof();
```

---

## FHE Operations Deep Dive

### 1. Answer Encryption (Question Creation)

```solidity
function createQuestion(string memory questionText, uint32 answer, uint64 reward) external {
    uint256 questionId = questionCount++;

    // FHE.asEuint32: Convert plaintext to encrypted ciphertext
    // This operation uses the global FHE key to encrypt on-chain
    euint32 encryptedAnswer = FHE.asEuint32(answer);

    // FHE.allowThis: Grant this contract permission to operate on the ciphertext
    // Required for any subsequent FHE operations
    FHE.allowThis(encryptedAnswer);

    questions[questionId] = Question({
        questionText: questionText,
        encryptedAnswer: encryptedAnswer,  // Stored encrypted, never revealed
        reward: reward,
        isActive: true,
        createdAt: block.timestamp
    });
}
```

### 2. External Encrypted Input Processing

```solidity
function submitEncryptedAnswer(
    uint256 questionId,
    externalEuint32 encryptedAnswer,  // Handle from client SDK
    bytes calldata inputProof          // ZK proof from client
) external returns (uint256) {
    // FHE.fromExternal: Verify and import externally encrypted value
    // Validates the proof and converts to internal euint32
    euint32 userEncryptedAnswer = FHE.fromExternal(encryptedAnswer, inputProof);

    // Must grant permission before any operations
    FHE.allowThis(userEncryptedAnswer);

    // ... continue with comparison
}
```

### 3. Homomorphic Comparison

```solidity
// FHE.eq: Homomorphic equality comparison
// Compares two encrypted values without decrypting either
// Returns encrypted boolean (ebool)
ebool isCorrect = FHE.eq(userEncryptedAnswer, question.encryptedAnswer);

// Grant permission and prepare for KMS decryption
FHE.allowThis(isCorrect);
FHE.makePubliclyDecryptable(isCorrect);
```

### 4. KMS Signature Verification

```solidity
function claimResult(
    uint256 pendingAnswerId,
    bool decryptedResult,
    bytes calldata decryptionProof
) external {
    PendingAnswer storage pending = pendingAnswers[pendingAnswerId];

    // Build handle list for verification
    bytes32[] memory handlesList = new bytes32[](1);
    handlesList[0] = FHE.toBytes32(pending.encryptedResult);

    // ABI encode the claimed decrypted value
    bytes memory abiEncodedResult = abi.encode(decryptedResult);

    // FHE.checkSignatures: Verify KMS threshold signatures
    // Reverts if signatures invalid or result doesn't match
    FHE.checkSignatures(handlesList, abiEncodedResult, decryptionProof);

    // If we reach here, the decrypted result is verified authentic
}
```

### FHE Permission Model (ACL)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FHE Access Control List (ACL)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  euint32 value = FHE.asEuint32(42);                             │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ACL State: value → { owner: creator, allowed: [] }      │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       │ FHE.allowThis(value)                                     │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ACL State: value → { owner: creator,                    │    │
│  │                      allowed: [address(this)] }         │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       │ FHE.eq(value, other) ← Requires permission!              │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ If address(this) ∈ allowed[value] → Operation succeeds  │    │
│  │ Else → Revert with ACLNotAllowed error                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
TreasureLottery/
├── contracts/                          # Solidity smart contracts
│   ├── QuestionTreasureBox.sol         # Main FHE game contract (422 lines)
│   ├── ChallengeTreasureBox.sol        # Challenge mode variant
│   ├── QuestionTreasureBoxTest.sol     # Non-FHE test variant
│   ├── SimplifiedQuestionBox.sol       # Simplified version
│   └── SimpleTreasureBoxV2.sol         # Legacy V2 implementation
│
├── test/                               # Hardhat test suites
│   ├── QuestionTreasureBox.fhe.test.js # FHE mock environment tests (28 tests)
│   └── QuestionTreasureBox.test.js     # Standard unit tests (30 tests)
│
├── scripts/                            # Deployment & utility scripts
│   ├── deploy.js                       # Main deployment script
│   ├── check-answer.js                 # Answer verification utility
│   ├── check-player.js                 # Player progress checker
│   ├── test-questions.js               # Question testing utility
│   ├── decode-tx.js                    # Transaction decoder
│   └── watch-events.js                 # Event listener
│
├── frontend/                           # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── TreasureChest.tsx       # Main game UI component
│   │   ├── config/
│   │   │   └── contract.ts             # Contract ABI & address
│   │   ├── lib/
│   │   │   └── fhe.ts                  # FHE SDK wrapper (main integration)
│   │   ├── hooks/                      # Custom React hooks
│   │   ├── pages/
│   │   │   └── Home.tsx                # Landing page
│   │   ├── App.tsx                     # Main app component
│   │   └── wagmi.config.ts             # Wagmi configuration
│   └── package.json
│
├── hardhat.config.js                   # Hardhat configuration
├── package.json                        # Root package configuration
└── README.md                           # This documentation
```

---

## Dependencies

### Smart Contract Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@fhevm/solidity` | ^0.9.1 | Zama FHE Solidity library |
| `@fhevm/hardhat-plugin` | ^0.3.0-1 | Hardhat FHE mock testing plugin |
| `hardhat` | ^2.22.0 | Development framework |
| `@nomicfoundation/hardhat-toolbox` | ^5.0.0 | Hardhat utilities bundle |
| `@nomicfoundation/hardhat-network-helpers` | ^1.1.0 | Network manipulation helpers |
| `@nomicfoundation/hardhat-verify` | ^2.0.0 | Contract verification |
| `chai` | ^4.5.0 | Assertion library |
| `dotenv` | ^16.4.0 | Environment variables |

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `vite` | ^5.4.19 | Build tool |
| `typescript` | ^5.8.3 | Type safety |
| `viem` | ^2.38.3 | Ethereum client |
| `wagmi` | ^2.18.2 | React hooks for Ethereum |
| `@rainbow-me/rainbowkit` | ^2.2.9 | Wallet connection UI |
| `@tanstack/react-query` | ^5.83.0 | Async state management |
| `framer-motion` | ^12.23.24 | Animations |
| `tailwindcss` | ^3.4.17 | Styling |
| `lucide-react` | ^0.462.0 | Icons |

### External Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| Zama Relayer SDK (CDN) | Client-side FHE encryption | [docs.zama.ai](https://docs.zama.ai) |
| Zama KMS | Threshold decryption service | [fhEVM docs](https://docs.zama.ai/fhevm) |
| Sepolia RPC | Ethereum testnet | [sepolia.dev](https://sepolia.dev) |
| Vercel | Frontend hosting | [vercel.com](https://vercel.com) |

---

## Local Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MetaMask or compatible wallet
- Sepolia testnet ETH ([Faucet](https://sepoliafaucet.com))

### Setup Instructions

```bash
# Clone repository
git clone https://github.com/CrystalValentine143517/Treasure-Lottery.git
cd Treasure-Lottery

# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Environment Configuration

Create `.env` file in root directory:

```bash
# Required for deployment
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPLOYER_PRIVATE_KEY=0x...your_private_key...

# Optional for verification
ETHERSCAN_API_KEY=...your_etherscan_api_key...
```

### Development Commands

```bash
# Compile contracts
npm run compile

# Run all tests
npm run test

# Run FHE-specific tests
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com" npx hardhat test test/QuestionTreasureBox.fhe.test.js

# Deploy to Sepolia
npm run deploy

# Start frontend development server
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build
```

---

## Unit Testing

### Test Suites Overview

| Suite | File | Tests | Coverage |
|-------|------|-------|----------|
| FHE Tests | `QuestionTreasureBox.fhe.test.js` | 28 | FHE operations, encrypted submissions |
| Standard Tests | `QuestionTreasureBox.test.js` | 30 | Business logic, edge cases |

### Running Tests

```bash
# Run all tests with FHE mock environment
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com" npx hardhat test

# Run only FHE tests
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com" npx hardhat test test/QuestionTreasureBox.fhe.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with verbose output
npx hardhat test --verbose
```

### FHE Test Categories

#### 1. Deployment Tests
```javascript
describe("Deployment with FHE", function () {
  it("Should deploy with 8 initial questions");
  it("Should set correct question texts");
  it("Should set correct rewards");
  it("Should set bonus question rewards correctly");
});
```

#### 2. Encrypted Answer Submission Tests
```javascript
describe("FHE Encrypted Answer Submission", function () {
  it("Should accept encrypted answer submission and return pending answer ID");
  it("Should store pending answer correctly");
  it("Should increment daily attempts on encrypted answer submission");
  it("Should reject encrypted answer for invalid question ID");
});
```

#### 3. Daily Limit Enforcement Tests
```javascript
describe("FHE Daily Limit Enforcement", function () {
  it("Should enforce 3 attempts per day with encrypted answers");
  it("Should reset daily limit after 24 hours");
});
```

#### 4. Multi-Player Tests
```javascript
describe("FHE Multiple Players", function () {
  it("Should allow different players to submit encrypted answers");
  it("Should have independent daily limits for different players");
});
```

#### 5. Edge Case Tests
```javascript
describe("Edge Cases with FHE", function () {
  it("Should handle zero as encrypted answer");
  it("Should handle max uint32 as encrypted answer");
  it("Should emit result handle in AnswerSubmitted event");
});
```

### Test Environment Setup

The FHE tests use the `@fhevm/hardhat-plugin` mock environment:

```javascript
before(async function () {
  // Initialize FHE mock environment
  if (hre.fhevm && hre.fhevm.isMock) {
    await hre.fhevm.initializeCLIApi();
  }
  fhevm = hre.fhevm;
});
```

### Creating Encrypted Test Inputs

```javascript
// Create encrypted input for testing
const input = fhevm.createEncryptedInput(contractAddress, player1.address);
input.add32(correctAnswer);  // Add uint32 value
const { handles, inputProof } = await input.encrypt();

// Submit to contract
await contract.connect(player1).submitEncryptedAnswer(
  questionId,
  handles[0],
  inputProof
);
```

### Time Manipulation for Daily Limits

```javascript
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Fast forward 24 hours
await time.increase(24 * 60 * 60);
```

---

## Deployment

### Contract Deployment

**Network**: Ethereum Sepolia Testnet
**Contract Address**: `0x8B4C4682EE9832FFeFAc0d38b2422A8Fa6a4115d`
**Explorer**: [View on Etherscan](https://sepolia.etherscan.io/address/0x8B4C4682EE9832FFeFAc0d38b2422A8Fa6a4115d)

### Deploy New Instance

```bash
# Ensure .env is configured
npm run deploy
```

### Frontend Deployment

**Platform**: Vercel
**URL**: [treasurelottery.vercel.app](https://treasurelottery.vercel.app)
**Build Command**: `npm run build`
**Output Directory**: `dist`

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

// Request decryption with automatic retry
requestDecryptionWithRetry(
  handle: `0x${string}`,
  maxRetries?: number,      // Default: 10
  retryDelayMs?: number,    // Default: 2000
  provider?: any
): Promise<{ decryptedResult: boolean; decryptionProof: `0x${string}` }>

// Status utilities
isFHEReady(): boolean
waitForFHE(timeoutMs?: number): Promise<boolean>
getFHEStatus(): { sdkLoaded: boolean; instanceReady: boolean }
```

### Contract ABI Highlights

```typescript
// Submit encrypted answer
function submitEncryptedAnswer(
  uint256 questionId,
  bytes32 encryptedAnswer,  // externalEuint32
  bytes calldata inputProof
) external returns (uint256 pendingAnswerId);

// Claim verified result
function claimResult(
  uint256 pendingAnswerId,
  bool decryptedResult,
  bytes calldata decryptionProof
) external;

// Get player progress
function getPlayerProgress(address player) external view returns (
  uint8 attemptsToday,
  uint8 remainingAttempts,
  uint256 totalSolved,
  uint64 totalRewards,
  uint256 timeUntilReset
);
```

---

## Security Considerations

### Cryptographic Security

| Aspect | Implementation | Security Level |
|--------|----------------|----------------|
| FHE Scheme | Zama TFHE-rs | 128-bit security |
| Key Management | Zama KMS (threshold) | Multi-party computation |
| Input Validation | ZK proofs via Relayer SDK | Cryptographic verification |
| Signature Verification | `FHE.checkSignatures()` | Threshold signatures |

### Smart Contract Security

- **Daily Limits**: Enforced via `DailyProgress` struct, reset checked on every submission
- **Duplicate Prevention**: `hasSolved` mapping prevents re-answering solved questions
- **ACL Enforcement**: All FHE values require explicit `FHE.allowThis()` before operations
- **Signature Verification**: KMS decryption proofs verified before reward distribution

### Known Limitations

1. **Demo Mode**: `answerQuestion()` encrypts on-chain (exposes answer in transaction)
2. **Pseudo-Random**: `getRandomQuestion()` uses `block.prevrandao` (predictable)
3. **No Withdrawal**: Rewards are virtual coins (no token contract)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Zama](https://www.zama.ai/) - fhEVM and FHE infrastructure
- [RainbowKit](https://www.rainbowkit.com/) - Wallet connection
- [Wagmi](https://wagmi.sh/) - React hooks for Ethereum
- [Vite](https://vitejs.dev/) - Frontend build tooling

---

<div align="center">

  **Built with Zama fhEVM v0.9.1**

  [Documentation](https://docs.zama.ai) | [Discord](https://discord.gg/zama) | [GitHub](https://github.com/zama-ai)

</div>
