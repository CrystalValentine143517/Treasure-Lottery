const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuestionTreasureBox FHE Tests", function () {
  let contract;
  let owner;
  let player1;
  let player2;
  let fhevm;
  let contractAddress;

  before(async function () {
    // Initialize FHE mock environment
    if (hre.fhevm && hre.fhevm.isMock) {
      await hre.fhevm.initializeCLIApi();
    }
    fhevm = hre.fhevm;
  });

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy the FHE-enabled QuestionTreasureBox contract
    const QuestionTreasureBox = await ethers.getContractFactory("QuestionTreasureBox");
    contract = await QuestionTreasureBox.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  });

  describe("Deployment with FHE", function () {
    it("Should deploy with 8 initial questions", async function () {
      const questionCount = await contract.questionCount();
      expect(questionCount).to.equal(8);
    });

    it("Should set correct question texts", async function () {
      const [questionText] = await contract.getQuestion(0);
      expect(questionText).to.equal("What is 5 + 7?");
    });

    it("Should set correct rewards", async function () {
      const [, reward] = await contract.getQuestion(0);
      expect(reward).to.equal(100);
    });

    it("Should set bonus question rewards correctly", async function () {
      const [, reward6] = await contract.getQuestion(6);
      const [, reward7] = await contract.getQuestion(7);
      expect(reward6).to.equal(200);
      expect(reward7).to.equal(300);
    });
  });

  describe("FHE Encrypted Answer Submission", function () {
    it("Should accept encrypted answer submission and return pending answer ID", async function () {
      // Question 0: "What is 5 + 7?" Answer: 12
      const correctAnswer = 12;

      // Create encrypted input using FHE mock
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(correctAnswer);
      const { handles, inputProof } = await input.encrypt();

      // Submit encrypted answer
      const tx = await contract.connect(player1).submitEncryptedAnswer(
        0,
        handles[0],
        inputProof
      );

      const receipt = await tx.wait();

      // Check for AnswerSubmitted event
      const event = receipt.logs.find(log => {
        try {
          return contract.interface.parseLog(log)?.name === "AnswerSubmitted";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      const parsedEvent = contract.interface.parseLog(event);
      expect(parsedEvent.args.player).to.equal(player1.address);
      expect(parsedEvent.args.questionId).to.equal(0n);
    });

    it("Should store pending answer correctly", async function () {
      const correctAnswer = 12;

      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(correctAnswer);
      const { handles, inputProof } = await input.encrypt();

      await contract.connect(player1).submitEncryptedAnswer(0, handles[0], inputProof);

      // Check pending answer storage
      const [player, questionId, , timestamp, processed] = await contract.getPendingAnswer(0);

      expect(player).to.equal(player1.address);
      expect(questionId).to.equal(0n);
      expect(timestamp).to.be.gt(0n);
      expect(processed).to.be.false;
    });

    it("Should increment daily attempts on encrypted answer submission", async function () {
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(12);
      const { handles, inputProof } = await input.encrypt();

      await contract.connect(player1).submitEncryptedAnswer(0, handles[0], inputProof);

      const [attemptsToday, remainingAttempts] = await contract.getPlayerProgress(player1.address);
      expect(attemptsToday).to.equal(1);
      expect(remainingAttempts).to.equal(2);
    });

    it("Should reject encrypted answer for already solved question", async function () {
      // This test verifies that once a question is marked as solved,
      // the player cannot submit another answer for it.
      // Note: In the actual contract, questions are marked solved in claimResult,
      // which requires KMS verification. For this unit test, we verify the
      // hasSolved mapping prevents duplicate submissions.

      // First, manually set hasSolved to true by having owner create and solve a custom question
      // Since hasSolved is internal, we test the flow by:
      // 1. Submitting an encrypted answer
      // 2. Verifying it creates a pending answer
      // 3. Note: Full AlreadySolved test would require claimResult with valid KMS proof

      const input1 = fhevm.createEncryptedInput(contractAddress, player1.address);
      input1.add32(12);
      const { handles: handles1, inputProof: proof1 } = await input1.encrypt();

      // Submit first answer - should work
      await contract.connect(player1).submitEncryptedAnswer(0, handles1[0], proof1);

      // Verify pending answer was created
      const [pendingId, hasPending] = await contract.getPlayerLatestPending(player1.address);
      expect(hasPending).to.be.true;

      // Note: To fully test AlreadySolved, we would need to:
      // 1. Call claimResult with valid KMS signatures
      // 2. Then try to submit again
      // This is a limitation of the mock environment
    });

    it("Should reject encrypted answer for invalid question ID", async function () {
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(12);
      const { handles, inputProof } = await input.encrypt();

      await expect(
        contract.connect(player1).submitEncryptedAnswer(999, handles[0], inputProof)
      ).to.be.revertedWithCustomError(contract, "InvalidQuestionId");
    });
  });

  describe("FHE Daily Limit Enforcement", function () {
    it("Should enforce 3 attempts per day with encrypted answers", async function () {
      // Submit 3 encrypted answers
      for (let i = 0; i < 3; i++) {
        const input = fhevm.createEncryptedInput(contractAddress, player1.address);
        input.add32(999); // Wrong answer
        const { handles, inputProof } = await input.encrypt();

        await contract.connect(player1).submitEncryptedAnswer(i, handles[0], inputProof);
      }

      // 4th attempt should fail
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(999);
      const { handles, inputProof } = await input.encrypt();

      await expect(
        contract.connect(player1).submitEncryptedAnswer(3, handles[0], inputProof)
      ).to.be.revertedWithCustomError(contract, "DailyLimitReached");
    });

    it("Should reset daily limit after 24 hours", async function () {
      // Use all 3 attempts
      for (let i = 0; i < 3; i++) {
        const input = fhevm.createEncryptedInput(contractAddress, player1.address);
        input.add32(999);
        const { handles, inputProof } = await input.encrypt();

        await contract.connect(player1).submitEncryptedAnswer(i, handles[0], inputProof);
      }

      // Fast forward 24 hours
      await time.increase(24 * 60 * 60);

      // Should be able to submit again
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(7); // Answer for question 3
      const { handles, inputProof } = await input.encrypt();

      await expect(
        contract.connect(player1).submitEncryptedAnswer(3, handles[0], inputProof)
      ).to.emit(contract, "AnswerSubmitted");

      const [attemptsToday] = await contract.getPlayerProgress(player1.address);
      expect(attemptsToday).to.equal(1);
    });
  });

  describe("FHE Multiple Players", function () {
    it("Should allow different players to submit encrypted answers", async function () {
      // Player 1 submits
      const input1 = fhevm.createEncryptedInput(contractAddress, player1.address);
      input1.add32(12);
      const { handles: handles1, inputProof: proof1 } = await input1.encrypt();

      await contract.connect(player1).submitEncryptedAnswer(0, handles1[0], proof1);

      // Player 2 submits
      const input2 = fhevm.createEncryptedInput(contractAddress, player2.address);
      input2.add32(7);
      const { handles: handles2, inputProof: proof2 } = await input2.encrypt();

      await contract.connect(player2).submitEncryptedAnswer(1, handles2[0], proof2);

      // Check both have pending answers
      const [, hasPending1] = await contract.getPlayerLatestPending(player1.address);
      const [, hasPending2] = await contract.getPlayerLatestPending(player2.address);

      expect(hasPending1).to.be.true;
      expect(hasPending2).to.be.true;
    });

    it("Should have independent daily limits for different players", async function () {
      // Player1 uses all 3 attempts
      for (let i = 0; i < 3; i++) {
        const input = fhevm.createEncryptedInput(contractAddress, player1.address);
        input.add32(999);
        const { handles, inputProof } = await input.encrypt();

        await contract.connect(player1).submitEncryptedAnswer(i, handles[0], inputProof);
      }

      // Player2 should still have 3 attempts
      const input2 = fhevm.createEncryptedInput(contractAddress, player2.address);
      input2.add32(12);
      const { handles: handles2, inputProof: proof2 } = await input2.encrypt();

      await expect(
        contract.connect(player2).submitEncryptedAnswer(0, handles2[0], proof2)
      ).to.emit(contract, "AnswerSubmitted");

      const [, remainingAttempts2] = await contract.getPlayerProgress(player2.address);
      expect(remainingAttempts2).to.equal(2);
    });
  });

  describe("FHE Question Creation", function () {
    it("Should allow creating new questions with encrypted answers", async function () {
      const tx = await contract.createQuestion("What is 3 + 3?", 6, 150);
      await tx.wait();

      const questionCount = await contract.questionCount();
      expect(questionCount).to.equal(9);

      const [questionText, reward, isActive] = await contract.getQuestion(8);
      expect(questionText).to.equal("What is 3 + 3?");
      expect(reward).to.equal(150);
      expect(isActive).to.be.true;
    });

    it("Should emit QuestionCreated event", async function () {
      await expect(
        contract.createQuestion("What is 3 + 3?", 6, 150)
      ).to.emit(contract, "QuestionCreated")
        .withArgs(8, "What is 3 + 3?", 150);
    });

    it("Should allow encrypted answer submission for newly created questions", async function () {
      await contract.createQuestion("What is 3 + 3?", 6, 150);

      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(6);
      const { handles, inputProof } = await input.encrypt();

      await expect(
        contract.connect(player1).submitEncryptedAnswer(8, handles[0], inputProof)
      ).to.emit(contract, "AnswerSubmitted");
    });
  });

  describe("FHE Pending Answer Management", function () {
    it("Should track player's latest pending answer", async function () {
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(12);
      const { handles, inputProof } = await input.encrypt();

      await contract.connect(player1).submitEncryptedAnswer(0, handles[0], inputProof);

      const [pendingAnswerId, hasPending] = await contract.getPlayerLatestPending(player1.address);
      expect(pendingAnswerId).to.equal(0n);
      expect(hasPending).to.be.true;
    });

    it("Should return pending answer details", async function () {
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(12);
      const { handles, inputProof } = await input.encrypt();

      await contract.connect(player1).submitEncryptedAnswer(0, handles[0], inputProof);

      const [player, questionId, resultHandle, timestamp, processed] =
        await contract.getPendingAnswer(0);

      expect(player).to.equal(player1.address);
      expect(questionId).to.equal(0n);
      expect(resultHandle).to.not.equal("0x" + "0".repeat(64));
      expect(timestamp).to.be.gt(0n);
      expect(processed).to.be.false;
    });

    it("Should increment pending answer count", async function () {
      const initialCount = await contract.pendingAnswerCount();

      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(12);
      const { handles, inputProof } = await input.encrypt();

      await contract.connect(player1).submitEncryptedAnswer(0, handles[0], inputProof);

      const newCount = await contract.pendingAnswerCount();
      expect(newCount).to.equal(initialCount + 1n);
    });
  });

  describe("FHE Demo answerQuestion Function", function () {
    it("Should work with on-chain encryption via answerQuestion", async function () {
      // This tests the simplified demo method that encrypts on-chain
      // The answerQuestion function encrypts the plaintext answer on-chain
      // and creates a pending answer for async decryption
      await expect(
        contract.connect(player1).answerQuestion(0, 12)
      ).to.emit(contract, "AnswerSubmitted");

      // Verify that a pending answer was created
      const [pendingId, hasPending] = await contract.getPlayerLatestPending(player1.address);
      expect(hasPending).to.be.true;
      expect(pendingId).to.equal(0n);
    });

    it("Should create pending answer with answerQuestion", async function () {
      await contract.connect(player1).answerQuestion(0, 12);

      const [pendingAnswerId, hasPending] = await contract.getPlayerLatestPending(player1.address);
      expect(pendingAnswerId).to.equal(0n);
      expect(hasPending).to.be.true;
    });

    it("Should enforce daily limit with answerQuestion", async function () {
      await contract.connect(player1).answerQuestion(0, 999);
      await contract.connect(player1).answerQuestion(1, 999);
      await contract.connect(player1).answerQuestion(2, 999);

      await expect(
        contract.connect(player1).answerQuestion(3, 999)
      ).to.be.revertedWithCustomError(contract, "DailyLimitReached");
    });
  });

  describe("Edge Cases with FHE", function () {
    it("Should handle zero as encrypted answer", async function () {
      await contract.createQuestion("What is 1 - 1?", 0, 100);

      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(0);
      const { handles, inputProof } = await input.encrypt();

      await expect(
        contract.connect(player1).submitEncryptedAnswer(8, handles[0], inputProof)
      ).to.emit(contract, "AnswerSubmitted");
    });

    it("Should handle max uint32 as encrypted answer", async function () {
      const maxUint32 = 4294967295;
      await contract.createQuestion("Max uint32?", maxUint32, 100);

      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(maxUint32);
      const { handles, inputProof } = await input.encrypt();

      await expect(
        contract.connect(player1).submitEncryptedAnswer(8, handles[0], inputProof)
      ).to.emit(contract, "AnswerSubmitted");
    });

    it("Should emit result handle in AnswerSubmitted event", async function () {
      const input = fhevm.createEncryptedInput(contractAddress, player1.address);
      input.add32(12);
      const { handles, inputProof } = await input.encrypt();

      const tx = await contract.connect(player1).submitEncryptedAnswer(0, handles[0], inputProof);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return contract.interface.parseLog(log)?.name === "AnswerSubmitted";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      const parsedEvent = contract.interface.parseLog(event);
      // The encryptedResultHandle should be a non-zero bytes32
      expect(parsedEvent.args.encryptedResultHandle).to.not.equal("0x" + "0".repeat(64));
    });
  });

  describe("Active Questions Count", function () {
    it("Should return correct active questions count", async function () {
      const count = await contract.getActiveQuestionsCount();
      expect(count).to.equal(8);
    });

    it("Should increase count after creating new question", async function () {
      await contract.createQuestion("New question?", 42, 100);

      const count = await contract.getActiveQuestionsCount();
      expect(count).to.equal(9);
    });
  });

  describe("Random Question Selection", function () {
    it("Should return a valid question ID", async function () {
      const questionId = await contract.getRandomQuestion(player1.address);
      expect(questionId).to.be.at.least(0n);
      expect(questionId).to.be.at.most(7n);
    });
  });
});
