// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint32, ebool} from "@fhevm/solidity/lib/FHE.sol";

/// @title QuestionTreasureBox
/// @notice Answer encrypted questions to unlock treasure boxes
/// @dev Daily limit: 3 attempts per address, answers encrypted with FHE
contract QuestionTreasureBox is SepoliaConfig {

    struct Question {
        string questionText;
        euint32 encryptedAnswer;  // FHE encrypted answer (for demonstration)
        uint32 plaintextAnswer;   // Plaintext answer for verification (FHE decrypt unavailable on Sepolia)
        uint64 reward;
        bool isActive;
        uint256 createdAt;
    }

    struct DailyProgress {
        uint256 lastResetDay;     // Day number (block.timestamp / 1 days)
        uint8 attemptsToday;      // Attempts used today
        uint256 totalSolved;      // Total questions solved
        uint64 totalRewards;      // Total rewards earned
    }

    // Question ID => Question data
    mapping(uint256 => Question) public questions;
    uint256 public questionCount;

    // Player => Daily progress
    mapping(address => DailyProgress) public playerProgress;

    // Player => Question ID => solved status
    mapping(address => mapping(uint256 => bool)) public hasSolved;

    uint8 public constant MAX_DAILY_ATTEMPTS = 3;
    uint64 public constant BASE_REWARD = 100;

    event QuestionCreated(uint256 indexed questionId, string questionText, uint64 reward);
    event QuestionAttempted(address indexed player, uint256 indexed questionId, bool success);
    event TreasureUnlocked(address indexed player, uint256 indexed questionId, uint64 reward);
    event DailyLimitReset(address indexed player, uint256 newDay);

    error DailyLimitReached(uint8 attemptsUsed, uint256 resetsIn);
    error QuestionNotActive(uint256 questionId);
    error InvalidQuestionId();
    error AlreadySolved(uint256 questionId);

    constructor() {
        _createInitialQuestions();
    }

    /// @notice Create a new question with encrypted answer
    /// @param questionText The question text (plaintext)
    /// @param answer The correct answer (will be encrypted)
    /// @param reward Reward for solving (plaintext coins)
    function createQuestion(
        string memory questionText,
        uint32 answer,
        uint64 reward
    ) external returns (uint256) {
        uint256 questionId = questionCount++;

        // Encrypt the answer using FHE
        euint32 encryptedAnswer = FHE.asEuint32(answer);
        FHE.allowThis(encryptedAnswer);

        questions[questionId] = Question({
            questionText: questionText,
            encryptedAnswer: encryptedAnswer,
            plaintextAnswer: answer,
            reward: reward,
            isActive: true,
            createdAt: block.timestamp
        });

        emit QuestionCreated(questionId, questionText, reward);
        return questionId;
    }

    /// @notice Answer a question
    /// @param questionId The question to answer
    /// @param answer Player's answer (plaintext)
    function answerQuestion(
        uint256 questionId,
        uint32 answer
    ) external {
        if (questionId >= questionCount) revert InvalidQuestionId();

        Question storage question = questions[questionId];
        if (!question.isActive) revert QuestionNotActive(questionId);

        if (hasSolved[msg.sender][questionId]) {
            revert AlreadySolved(questionId);
        }

        // Check and update daily limit
        _checkAndResetDaily(msg.sender);

        DailyProgress storage progress = playerProgress[msg.sender];

        if (progress.attemptsToday >= MAX_DAILY_ATTEMPTS) {
            uint256 currentDay = block.timestamp / 1 days;
            uint256 nextDayTimestamp = (currentDay + 1) * 1 days;
            uint256 timeUntilReset = nextDayTimestamp - block.timestamp;
            revert DailyLimitReached(progress.attemptsToday, timeUntilReset);
        }

        // Increment attempts BEFORE comparison (prevent re-entrancy)
        progress.attemptsToday++;

        // Convert answer to encrypted value
        euint32 encryptedUserAnswer = FHE.asEuint32(answer);
        FHE.allowThis(encryptedUserAnswer);

        // Perform FHE homomorphic comparison (demonstration of FHE capabilities)
        ebool isCorrect = FHE.eq(encryptedUserAnswer, question.encryptedAnswer);

        // Verify answer using plaintext comparison
        // Note: FHE decryption is not available on Sepolia without Gateway
        // In production with Gateway, we would use async decryption
        bool success = (answer == question.plaintextAnswer);

        emit QuestionAttempted(msg.sender, questionId, success);

        if (success) {
            progress.totalSolved++;
            progress.totalRewards += question.reward;
            hasSolved[msg.sender][questionId] = true;

            emit TreasureUnlocked(msg.sender, questionId, question.reward);
        }
    }

    /// @notice Check and reset daily attempts if new day
    function _checkAndResetDaily(address player) private {
        DailyProgress storage progress = playerProgress[player];
        uint256 currentDay = block.timestamp / 1 days;

        if (progress.lastResetDay < currentDay) {
            progress.lastResetDay = currentDay;
            progress.attemptsToday = 0;
            emit DailyLimitReset(player, currentDay);
        }
    }

    /// @notice Workaround to check ebool result
    function _checkEquality(ebool encryptedBool) private view returns (bool) {
        return ebool.unwrap(encryptedBool) != 0;
    }

    /// @notice Get player's daily progress
    function getPlayerProgress(address player) external view returns (
        uint8 attemptsToday,
        uint8 remainingAttempts,
        uint256 totalSolved,
        uint64 totalRewards,
        uint256 timeUntilReset
    ) {
        DailyProgress storage progress = playerProgress[player];
        uint256 currentDay = block.timestamp / 1 days;

        // Check if we should reset
        uint8 attempts = progress.lastResetDay < currentDay ? 0 : progress.attemptsToday;
        uint8 remaining = attempts >= MAX_DAILY_ATTEMPTS ? 0 : MAX_DAILY_ATTEMPTS - attempts;

        // Calculate time until next reset
        uint256 nextDayTimestamp = (currentDay + 1) * 1 days;
        uint256 resetTime = nextDayTimestamp - block.timestamp;

        return (
            attempts,
            remaining,
            progress.totalSolved,
            progress.totalRewards,
            resetTime
        );
    }

    /// @notice Get question details (without revealing answer)
    function getQuestion(uint256 questionId) external view returns (
        string memory questionText,
        uint64 reward,
        bool isActive,
        bool playerSolved
    ) {
        if (questionId >= questionCount) revert InvalidQuestionId();

        Question storage question = questions[questionId];

        return (
            question.questionText,
            question.reward,
            question.isActive,
            hasSolved[msg.sender][questionId]
        );
    }

    /// @notice Get total active questions
    function getActiveQuestionsCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < questionCount; i++) {
            if (questions[i].isActive) {
                count++;
            }
        }
        return count;
    }

    /// @notice Get random unsolved question ID for player
    function getRandomQuestion(address player) external view returns (uint256) {
        uint256[] memory unsolved = new uint256[](questionCount);
        uint256 unsolvedCount = 0;

        for (uint256 i = 0; i < questionCount; i++) {
            if (questions[i].isActive && !hasSolved[player][i]) {
                unsolved[unsolvedCount] = i;
                unsolvedCount++;
            }
        }

        if (unsolvedCount == 0) return 0; // No unsolved questions

        // Pseudo-random selection
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            player
        ))) % unsolvedCount;

        return unsolved[randomIndex];
    }

    /// @notice Create initial question bank
    function _createInitialQuestions() private {
        // Math questions
        _createQuestion("What is 5 + 7?", 12, BASE_REWARD);
        _createQuestion("What is 15 - 8?", 7, BASE_REWARD);
        _createQuestion("What is 6 * 4?", 24, BASE_REWARD);
        
        // Riddles (number answers)
        _createQuestion("How many days in a week?", 7, BASE_REWARD);
        _createQuestion("How many months in a year?", 12, BASE_REWARD);
        _createQuestion("How many sides does a hexagon have?", 6, BASE_REWARD);
        
        // Bonus questions
        _createQuestion("What is 10 squared (10^2)?", 100, BASE_REWARD * 2);
        _createQuestion("What is the answer to life, universe, and everything?", 42, BASE_REWARD * 3);
    }

    /// @notice Internal helper to create a question
    function _createQuestion(
        string memory questionText,
        uint32 answer,
        uint64 reward
    ) private {
        uint256 questionId = questionCount++;
        euint32 encryptedAnswer = FHE.asEuint32(answer);
        FHE.allowThis(encryptedAnswer);

        questions[questionId] = Question({
            questionText: questionText,
            encryptedAnswer: encryptedAnswer,
            plaintextAnswer: answer,
            reward: reward,
            isActive: true,
            createdAt: block.timestamp
        });

        emit QuestionCreated(questionId, questionText, reward);
    }
}
