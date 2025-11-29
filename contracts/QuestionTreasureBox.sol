// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";

/// @title QuestionTreasureBox
/// @notice Answer encrypted questions to unlock treasure boxes using FHE
/// @dev Daily limit: 3 attempts per address, answers verified with FHE
/// @dev fhEVM v0.9.1 with self-relaying decryption model
contract QuestionTreasureBox is ZamaEthereumConfig {

    struct Question {
        string questionText;
        euint32 encryptedAnswer;  // FHE encrypted correct answer
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

    struct PendingAnswer {
        address player;
        uint256 questionId;
        ebool encryptedResult;    // FHE encrypted comparison result
        uint256 timestamp;
        bool processed;
    }

    // Question ID => Question data
    mapping(uint256 => Question) public questions;
    uint256 public questionCount;

    // Player => Daily progress
    mapping(address => DailyProgress) public playerProgress;

    // Player => Question ID => solved status
    mapping(address => mapping(uint256 => bool)) public hasSolved;

    // Answer ID => Pending answer data
    mapping(uint256 => PendingAnswer) public pendingAnswers;
    uint256 public pendingAnswerCount;

    // Player => latest pending answer ID
    mapping(address => uint256) public playerPendingAnswer;

    uint8 public constant MAX_DAILY_ATTEMPTS = 3;
    uint64 public constant BASE_REWARD = 100;

    event QuestionCreated(uint256 indexed questionId, string questionText, uint64 reward);
    event AnswerSubmitted(address indexed player, uint256 indexed questionId, uint256 pendingAnswerId, bytes32 encryptedResultHandle);
    event TreasureUnlocked(address indexed player, uint256 indexed questionId, uint64 reward);
    event AnswerWrong(address indexed player, uint256 indexed questionId);
    event DailyLimitReset(address indexed player, uint256 newDay);

    error DailyLimitReached(uint8 attemptsUsed, uint256 resetsIn);
    error QuestionNotActive(uint256 questionId);
    error InvalidQuestionId();
    error AlreadySolved(uint256 questionId);
    error NoPendingAnswer();
    error AnswerAlreadyProcessed();
    error InvalidDecryptionProof();

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

        // Encrypt the answer using FHE (v0.9.1)
        euint32 encryptedAnswer = FHE.asEuint32(answer);
        FHE.allowThis(encryptedAnswer);

        questions[questionId] = Question({
            questionText: questionText,
            encryptedAnswer: encryptedAnswer,
            reward: reward,
            isActive: true,
            createdAt: block.timestamp
        });

        emit QuestionCreated(questionId, questionText, reward);
        return questionId;
    }

    /// @notice Submit an encrypted answer for FHE comparison
    /// @param questionId The question to answer
    /// @param encryptedAnswer User's encrypted answer (from frontend FHE SDK)
    /// @param inputProof Proof for the encrypted input
    /// @return pendingAnswerId ID to use for claiming the result
    function submitEncryptedAnswer(
        uint256 questionId,
        externalEuint32 encryptedAnswer,
        bytes calldata inputProof
    ) external returns (uint256) {
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

        // Increment attempts
        progress.attemptsToday++;

        // Convert external encrypted input to euint32 using FHE SDK proof
        euint32 userEncryptedAnswer = FHE.fromExternal(encryptedAnswer, inputProof);
        FHE.allowThis(userEncryptedAnswer);

        // Perform FHE homomorphic comparison (encrypted == encrypted)
        ebool isCorrect = FHE.eq(userEncryptedAnswer, question.encryptedAnswer);
        FHE.allowThis(isCorrect);
        FHE.makePubliclyDecryptable(isCorrect);

        // Store pending answer for later verification
        uint256 pendingAnswerId = pendingAnswerCount++;
        pendingAnswers[pendingAnswerId] = PendingAnswer({
            player: msg.sender,
            questionId: questionId,
            encryptedResult: isCorrect,
            timestamp: block.timestamp,
            processed: false
        });

        playerPendingAnswer[msg.sender] = pendingAnswerId;

        // Emit event with the handle for frontend to request decryption
        bytes32 resultHandle = FHE.toBytes32(isCorrect);
        emit AnswerSubmitted(msg.sender, questionId, pendingAnswerId, resultHandle);

        return pendingAnswerId;
    }

    /// @notice Claim result after frontend decrypts the ebool result
    /// @param pendingAnswerId The pending answer ID from submitEncryptedAnswer
    /// @param decryptedResult The decrypted boolean result from KMS
    /// @param decryptionProof The KMS signature proof
    function claimResult(
        uint256 pendingAnswerId,
        bool decryptedResult,
        bytes calldata decryptionProof
    ) external {
        PendingAnswer storage pending = pendingAnswers[pendingAnswerId];

        if (pending.player != msg.sender) revert NoPendingAnswer();
        if (pending.processed) revert AnswerAlreadyProcessed();

        // Verify KMS signatures using FHE.checkSignatures
        bytes32[] memory handlesList = new bytes32[](1);
        handlesList[0] = FHE.toBytes32(pending.encryptedResult);

        // ABI encode the decrypted result (bool padded to 32 bytes)
        bytes memory abiEncodedCleartexts = abi.encode(decryptedResult);

        // This will revert if signatures are invalid
        FHE.checkSignatures(handlesList, abiEncodedCleartexts, decryptionProof);

        // Mark as processed
        pending.processed = true;

        Question storage question = questions[pending.questionId];
        DailyProgress storage progress = playerProgress[msg.sender];

        if (decryptedResult) {
            // Correct answer!
            progress.totalSolved++;
            progress.totalRewards += question.reward;
            hasSolved[msg.sender][pending.questionId] = true;

            emit TreasureUnlocked(msg.sender, pending.questionId, question.reward);
        } else {
            // Wrong answer
            emit AnswerWrong(msg.sender, pending.questionId);
        }
    }

    /// @notice Simplified answer function for demo (encrypts plaintext on-chain)
    /// @dev This encrypts the plaintext answer on-chain for comparison
    /// @param questionId The question to answer
    /// @param answer Player's answer (plaintext - will be encrypted on-chain)
    function answerQuestion(
        uint256 questionId,
        uint32 answer
    ) external returns (uint256) {
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

        // Increment attempts BEFORE comparison
        progress.attemptsToday++;

        // Encrypt user's answer on-chain
        euint32 encryptedUserAnswer = FHE.asEuint32(answer);
        FHE.allowThis(encryptedUserAnswer);

        // Perform FHE homomorphic comparison
        ebool isCorrect = FHE.eq(encryptedUserAnswer, question.encryptedAnswer);
        FHE.allowThis(isCorrect);
        FHE.makePubliclyDecryptable(isCorrect);

        // Store for async decryption
        uint256 pendingAnswerId = pendingAnswerCount++;
        pendingAnswers[pendingAnswerId] = PendingAnswer({
            player: msg.sender,
            questionId: questionId,
            encryptedResult: isCorrect,
            timestamp: block.timestamp,
            processed: false
        });

        playerPendingAnswer[msg.sender] = pendingAnswerId;

        bytes32 resultHandle = FHE.toBytes32(isCorrect);
        emit AnswerSubmitted(msg.sender, questionId, pendingAnswerId, resultHandle);

        return pendingAnswerId;
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

    /// @notice Get pending answer info
    function getPendingAnswer(uint256 pendingAnswerId) external view returns (
        address player,
        uint256 questionId,
        bytes32 resultHandle,
        uint256 timestamp,
        bool processed
    ) {
        PendingAnswer storage pending = pendingAnswers[pendingAnswerId];
        return (
            pending.player,
            pending.questionId,
            FHE.toBytes32(pending.encryptedResult),
            pending.timestamp,
            pending.processed
        );
    }

    /// @notice Get player's latest pending answer
    function getPlayerLatestPending(address player) external view returns (uint256 pendingAnswerId, bool hasPending) {
        uint256 id = playerPendingAnswer[player];
        PendingAnswer storage pending = pendingAnswers[id];
        return (id, pending.player == player && !pending.processed);
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

        // Encrypt the answer using FHE (v0.9.1)
        euint32 encryptedAnswer = FHE.asEuint32(answer);
        FHE.allowThis(encryptedAnswer);

        questions[questionId] = Question({
            questionText: questionText,
            encryptedAnswer: encryptedAnswer,
            reward: reward,
            isActive: true,
            createdAt: block.timestamp
        });

        emit QuestionCreated(questionId, questionText, reward);
    }
}
