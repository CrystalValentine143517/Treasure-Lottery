# Treasure Lottery 🎁

<div align="center">
  <img src="frontend/src/assets/chest-closed.png" alt="Treasure Lottery Logo" width="200"/>

  ### FHE-Powered Q&A Treasure Hunt Game

  Answer encrypted questions to unlock treasure chests and win rewards!

  [![Live Demo](https://img.shields.io/badge/Demo-treasurelottery.vercel.app-blue?style=for-the-badge)](https://treasurelottery.vercel.app)
  [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
  [![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
  [![Zama FHE](https://img.shields.io/badge/Zama-FHE-7C3AED?style=for-the-badge)](https://www.zama.ai/)
</div>

---

## 🎮 What is Treasure Lottery?

Treasure Lottery is an on-chain quiz game where players answer encrypted questions to unlock treasure chests. Built with **Zama's Fully Homomorphic Encryption (FHE)** technology, the game demonstrates privacy-preserving computation on the blockchain.

### 🎯 Game Features

- **8 Unique Questions**: Math problems, riddles, and trivia challenges
- **Daily Challenge System**: 3 attempts per day per wallet address
- **Encrypted Verification**: Answers are verified using FHE without exposing correct answers on-chain
- **Progressive Rewards**: 100-300 coins depending on question difficulty
- **Real-time Updates**: Instant feedback on answer correctness
- **Wallet Integration**: Connect with MetaMask via RainbowKit

---

## 🔐 How FHE Powers the Game

### What is FHE?

**Fully Homomorphic Encryption (FHE)** allows computations to be performed on encrypted data without decrypting it. This means:
- ✅ Correct answers are stored **encrypted** on-chain
- ✅ Player answers are **encrypted** before comparison
- ✅ Verification happens through **homomorphic equality checks**
- ✅ No sensitive data is ever exposed in plaintext

### FHE Implementation

```solidity
// Store encrypted answer
euint32 encryptedAnswer = FHE.asEuint32(answer);
FHE.allowThis(encryptedAnswer);

// Encrypt user's answer
euint32 encryptedUserAnswer = FHE.asEuint32(userAnswer);

// Homomorphic comparison (without decryption!)
ebool isCorrect = FHE.eq(encryptedUserAnswer, question.encryptedAnswer);
```

**Key FHE Operations Used:**
- `FHE.asEuint32()` - Encrypt plaintext values
- `FHE.eq()` - Homomorphic equality comparison
- `FHE.allowThis()` - Grant contract permission to access encrypted values

---

## 🎲 How to Play

### Step 1: Connect Wallet
Visit [treasurelottery.vercel.app](https://treasurelottery.vercel.app) and connect your wallet (Sepolia testnet required).

### Step 2: Answer Questions
You'll see a random question from our question bank:
- **Math Questions**: Simple arithmetic (e.g., "What is 5 + 7?")
- **Riddles**: Number-based puzzles (e.g., "How many days in a week?")
- **Bonus Questions**: Higher difficulty, higher rewards

### Step 3: Submit Your Answer
Enter your numeric answer and submit. The smart contract will:
1. Encrypt your answer using FHE
2. Compare it with the stored encrypted answer
3. Update your progress if correct

### Step 4: Claim Rewards
- ✅ Correct answer → Treasure chest opens, coins awarded!
- ❌ Wrong answer → Try again (if attempts remaining)

### Daily Limits
- **3 attempts per day** per wallet address
- Resets automatically every 24 hours
- Track your progress: total solved questions and total rewards earned

---

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity 0.8.24** - Smart contract language
- **Zama fhEVM** - FHE library for Solidity
- **Hardhat** - Development framework
- **Sepolia Testnet** - Deployment network

### Frontend
- **React 18.3** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **RainbowKit + Wagmi v2** - Wallet connection
- **Ant Design 5.0** - UI components
- **Framer Motion** - Animations
- **TailwindCSS** - Styling

---

## 📦 Project Structure

```
EncryptedTreasure-Dive/
├── contracts/
│   ├── QuestionTreasureBox.sol    # Main game contract with FHE
│   ├── ChallengeTreasureBox.sol   # Challenge variant
│   └── SimplifiedQuestionBox.sol  # Non-FHE version
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TreasureChest.tsx  # Main game component
│   │   │   ├── Header.tsx         # Navigation
│   │   │   └── ui/                # Shared UI components
│   │   ├── config/
│   │   │   └── contract.ts        # Contract ABI & address
│   │   └── assets/                # Images and resources
│   └── package.json
├── scripts/
│   ├── deploy.js                  # Deployment script
│   ├── test-questions.js          # Test contract questions
│   └── check-player.js            # Check player progress
└── hardhat.config.js              # Hardhat configuration
```

---

## 🚀 Deployment

### Smart Contract
**Network**: Sepolia Testnet
**Contract Address**: `0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB`
**Etherscan**: [View on Etherscan](https://sepolia.etherscan.io/address/0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB)

### Frontend
**Live Demo**: [treasurelottery.vercel.app](https://treasurelottery.vercel.app)
**Platform**: Vercel
**Auto-Deploy**: Enabled on `main` branch

---

## 💻 Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask wallet
- Sepolia testnet ETH

### Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

### Run Frontend
```bash
cd frontend
npm run dev
```
Visit `http://localhost:8080`

### Compile Contracts
```bash
npx hardhat compile
```

### Deploy Contract
```bash
SEPOLIA_RPC_URL="<your-rpc-url>" npx hardhat run scripts/deploy.js --network sepolia
```

---

## 🎯 Game Rules

### Question Bank (8 Questions Total)

| ID | Question | Answer | Reward |
|----|----------|--------|--------|
| 0 | What is 5 + 7? | 12 | 100 |
| 1 | What is 15 - 8? | 7 | 100 |
| 2 | What is 6 * 4? | 24 | 100 |
| 3 | How many days in a week? | 7 | 100 |
| 4 | How many months in a year? | 12 | 100 |
| 5 | How many sides does a hexagon have? | 6 | 100 |
| 6 | What is 10 squared (10^2)? | 100 | 200 |
| 7 | What is the answer to life, universe, and everything? | 42 | 300 |

### Scoring System
- **Regular Questions**: 100 coins each
- **Bonus Questions**: 200-300 coins
- **Daily Limit**: Maximum 3 attempts per day
- **Solved Questions**: Cannot be answered again by the same wallet

---

## 🔧 Smart Contract Functions

### Player Functions
```solidity
// Answer a question
function answerQuestion(uint256 questionId, uint32 answer) external

// Get player's progress
function getPlayerProgress(address player) external view returns (
    uint8 attemptsToday,
    uint8 remainingAttempts,
    uint256 totalSolved,
    uint64 totalRewards,
    uint256 timeUntilReset
)

// Get random unsolved question
function getRandomQuestion(address player) external view returns (uint256)

// Get question details
function getQuestion(uint256 questionId) external view returns (
    string memory questionText,
    uint64 reward,
    bool isActive,
    bool playerSolved
)
```

### Events
```solidity
event QuestionAttempted(address indexed player, uint256 indexed questionId, bool success);
event TreasureUnlocked(address indexed player, uint256 indexed questionId, uint64 reward);
event DailyLimitReset(address indexed player, uint256 newDay);
```

---

## 🎨 UI/UX Features

- **Animated Treasure Chest**: Opens when answer is correct
- **Particle Effects**: Celebration animation on success
- **Progress Tracking**: Real-time display of attempts and rewards
- **Daily Reset Timer**: Countdown to next reset
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Eye-friendly interface
- **Toast Notifications**: Instant feedback on actions

---

## 🔒 Security Features

### FHE Privacy
- Correct answers are **never exposed** on-chain
- Answer verification happens through **encrypted comparison**
- No need to trust server or frontend for answer validation

### Smart Contract Security
- **Re-entrancy Protection**: Attempts incremented before comparison
- **Daily Limit Enforcement**: Automatic reset mechanism
- **Already Solved Check**: Prevents double-claiming rewards
- **Input Validation**: All user inputs are validated

---

## 📝 License

This project is open source and available under the MIT License.

---

## 🙏 Acknowledgments

- **Zama** - For providing the fhEVM library and FHE infrastructure
- **OpenZeppelin** - Smart contract security standards
- **RainbowKit** - Beautiful wallet connection UI
- **Ant Design** - Comprehensive UI component library

---

## 🔗 Links

- **Live Demo**: [treasurelottery.vercel.app](https://treasurelottery.vercel.app)
- **GitHub**: [Treasure-Lottery](https://github.com/CrystalValentine143517/Treasure-Lottery)
- **Contract**: [0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB](https://sepolia.etherscan.io/address/0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB)
- **Zama Documentation**: [docs.zama.ai](https://docs.zama.ai)

---

<div align="center">

  **Built with ❤️ using Zama FHE Technology**

  Made by CrystalValentine143517

</div>
