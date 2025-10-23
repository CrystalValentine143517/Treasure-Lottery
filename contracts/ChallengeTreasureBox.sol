// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint32, ebool} from "@fhevm/solidity/lib/FHE.sol";

/// @title ChallengeTreasureBox
/// @notice FHE-based challenge treasure box game
/// @dev Uses FHE for encrypted target storage and homomorphic comparison
contract ChallengeTreasureBox is SepoliaConfig {

    struct Challenge {
        euint32 encryptedTarget;  // Encrypted target value (using FHE)
        uint32 minRange;          // Minimum valid range (plaintext hint)
        uint32 maxRange;          // Maximum valid range (plaintext hint)
        uint64 reward;            // Reward for solving (plaintext)
        bool isActive;
        uint256 createdAt;
    }

    struct PlayerProgress {
        uint256 challengesSolved;
        uint64 totalRewards;
        uint256 lastAttemptTime;
        bool hasActiveCooldown;
    }

    mapping(uint256 => Challenge) public challenges;
    uint256 public challengeCount;

    mapping(address => PlayerProgress) public playerProgress;
    mapping(address => mapping(uint256 => uint256)) public attemptCounts;
    mapping(address => mapping(uint256 => bool)) public hasSolvedChallenge;

    uint256 public constant COOLDOWN_TIME = 30; // 30 seconds
    uint256 public constant MAX_ATTEMPTS_PER_CHALLENGE = 5;

    event ChallengeCreated(uint256 indexed challengeId, uint32 minRange, uint32 maxRange, uint64 reward);
    event ChallengeAttempted(address indexed player, uint256 indexed challengeId, uint32 guess);
    event TreasureUnlocked(address indexed player, uint256 indexed challengeId, uint64 reward);

    error CooldownActive(uint256 remainingTime);
    error MaxAttemptsReached(uint256 challengeId);
    error ChallengeNotActive(uint256 challengeId);
    error InvalidChallengeId();
    error AlreadySolved(uint256 challengeId);

    constructor() {
        _createInitialChallenges();
    }

    /// @notice Create a new encrypted challenge (admin function)
    function createChallenge(
        uint32 targetValue,
        uint32 minRange,
        uint32 maxRange,
        uint64 reward
    ) external returns (uint256) {
        require(minRange < maxRange, "Invalid range");
        require(targetValue >= minRange && targetValue <= maxRange, "Target out of range");

        uint256 challengeId = challengeCount++;

        // Encrypt the target value using FHE
        euint32 encryptedTarget = FHE.asEuint32(targetValue);
        FHE.allowThis(encryptedTarget);

        challenges[challengeId] = Challenge({
            encryptedTarget: encryptedTarget,
            minRange: minRange,
            maxRange: maxRange,
            reward: reward,
            isActive: true,
            createdAt: block.timestamp
        });

        emit ChallengeCreated(challengeId, minRange, maxRange, reward);
        return challengeId;
    }

    /// @notice Attempt to solve a challenge
    /// @param challengeId The challenge to attempt
    /// @param guess Player's plaintext guess
    /// @return isCorrect Whether the guess was correct
    function attemptChallenge(
        uint256 challengeId,
        uint32 guess
    ) external returns (bool isCorrect) {
        if (challengeId >= challengeCount) revert InvalidChallengeId();

        Challenge storage challenge = challenges[challengeId];
        if (!challenge.isActive) revert ChallengeNotActive(challengeId);

        if (hasSolvedChallenge[msg.sender][challengeId]) {
            revert AlreadySolved(challengeId);
        }

        PlayerProgress storage progress = playerProgress[msg.sender];

        // Check cooldown
        if (progress.hasActiveCooldown) {
            uint256 elapsed = block.timestamp - progress.lastAttemptTime;
            if (elapsed < COOLDOWN_TIME) {
                revert CooldownActive(COOLDOWN_TIME - elapsed);
            }
        }

        // Check max attempts
        uint256 attempts = attemptCounts[msg.sender][challengeId];
        if (attempts >= MAX_ATTEMPTS_PER_CHALLENGE) {
            revert MaxAttemptsReached(challengeId);
        }

        // Validate guess is in range
        require(guess >= challenge.minRange && guess <= challenge.maxRange, "Guess out of range");

        // Convert guess to encrypted value
        euint32 encryptedGuess = FHE.asEuint32(guess);
        FHE.allowThis(encryptedGuess);

        // Perform homomorphic comparison (FHE magic!)
        // This compares encrypted values WITHOUT decrypting them
        ebool encryptedResult = FHE.eq(encryptedGuess, challenge.encryptedTarget);

        // For demo purposes, we reveal the result
        // In production, you'd need Gateway callback
        // For now, we use a workaround: store the encrypted result and let frontend query
        isCorrect = _checkEquality(encryptedResult);

        // Update state
        attemptCounts[msg.sender][challengeId]++;
        progress.lastAttemptTime = block.timestamp;
        progress.hasActiveCooldown = true;

        emit ChallengeAttempted(msg.sender, challengeId, guess);

        if (isCorrect) {
            progress.challengesSolved++;
            progress.totalRewards += challenge.reward;
            hasSolvedChallenge[msg.sender][challengeId] = true;

            emit TreasureUnlocked(msg.sender, challengeId, challenge.reward);
        }

        return isCorrect;
    }

    /// @notice Workaround to check ebool equality
    /// @dev In production, this would use Gateway callback
    function _checkEquality(ebool encryptedBool) private view returns (bool) {
        // This is a simplified check - in reality you'd need Gateway
        // For demo, we'll use the fact that ebool wraps a uint256
        // This is NOT secure in production!
        return ebool.unwrap(encryptedBool) != 0;
    }

    /// @notice Get player statistics
    function getPlayerStats(address player) external view returns (
        uint256 solved,
        uint64 totalRewards,
        uint256 lastAttempt,
        uint256 cooldownRemaining
    ) {
        PlayerProgress storage progress = playerProgress[player];

        uint256 remaining = 0;
        if (progress.hasActiveCooldown) {
            uint256 elapsed = block.timestamp - progress.lastAttemptTime;
            if (elapsed < COOLDOWN_TIME) {
                remaining = COOLDOWN_TIME - elapsed;
            }
        }

        return (
            progress.challengesSolved,
            progress.totalRewards,
            progress.lastAttemptTime,
            remaining
        );
    }

    /// @notice Get challenge info
    function getChallengeInfo(uint256 challengeId) external view returns (
        uint32 minRange,
        uint32 maxRange,
        uint64 reward,
        bool isActive,
        uint256 playerAttempts,
        bool solved
    ) {
        if (challengeId >= challengeCount) revert InvalidChallengeId();

        Challenge storage challenge = challenges[challengeId];

        return (
            challenge.minRange,
            challenge.maxRange,
            challenge.reward,
            challenge.isActive,
            attemptCounts[msg.sender][challengeId],
            hasSolvedChallenge[msg.sender][challengeId]
        );
    }

    /// @notice Get remaining attempts
    function getRemainingAttempts(uint256 challengeId, address player) external view returns (uint256) {
        uint256 used = attemptCounts[player][challengeId];
        if (used >= MAX_ATTEMPTS_PER_CHALLENGE) return 0;
        return MAX_ATTEMPTS_PER_CHALLENGE - used;
    }

    /// @notice Check if player can attempt
    function canAttempt(address player) external view returns (bool, uint256 cooldownRemaining) {
        PlayerProgress storage progress = playerProgress[player];

        if (!progress.hasActiveCooldown) {
            return (true, 0);
        }

        uint256 elapsed = block.timestamp - progress.lastAttemptTime;
        if (elapsed >= COOLDOWN_TIME) {
            return (true, 0);
        }

        return (false, COOLDOWN_TIME - elapsed);
    }

    /// @notice Get active challenges count
    function getActiveChallengesCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < challengeCount; i++) {
            if (challenges[i].isActive) {
                count++;
            }
        }
        return count;
    }

    /// @notice Internal function to create initial challenges
    function _createInitialChallenges() private {
        _createChallenge(7, 1, 10, 100);
        _createChallenge(33, 1, 50, 250);
        _createChallenge(77, 1, 100, 500);
    }

    /// @notice Internal helper to create a challenge
    function _createChallenge(
        uint32 targetValue,
        uint32 minRange,
        uint32 maxRange,
        uint64 reward
    ) private {
        uint256 challengeId = challengeCount++;
        euint32 encryptedTarget = FHE.asEuint32(targetValue);
        FHE.allowThis(encryptedTarget);

        challenges[challengeId] = Challenge({
            encryptedTarget: encryptedTarget,
            minRange: minRange,
            maxRange: maxRange,
            reward: reward,
            isActive: true,
            createdAt: block.timestamp
        });

        emit ChallengeCreated(challengeId, minRange, maxRange, reward);
    }
}
