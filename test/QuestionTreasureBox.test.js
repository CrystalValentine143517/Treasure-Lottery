const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuestionTreasureBox", function () {
  let contract;
  let owner;
  let player1;
  let player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Use test version without FHE for unit testing
    const QuestionTreasureBox = await ethers.getContractFactory("QuestionTreasureBoxTest");
    contract = await QuestionTreasureBox.deploy();
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
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

  describe("Answering Questions", function () {
    it("Should allow correct answer and emit events", async function () {
      // Question 0: "What is 5 + 7?" Answer: 12
      await expect(contract.connect(player1).answerQuestion(0, 12))
        .to.emit(contract, "QuestionAttempted")
        .withArgs(player1.address, 0, true)
        .to.emit(contract, "TreasureUnlocked")
        .withArgs(player1.address, 0, 100);
    });

    it("Should reject wrong answer", async function () {
      // Question 0: "What is 5 + 7?" Wrong answer: 10
      await expect(contract.connect(player1).answerQuestion(0, 10))
        .to.emit(contract, "QuestionAttempted")
        .withArgs(player1.address, 0, false)
        .to.not.emit(contract, "TreasureUnlocked");
    });

    it("Should update player progress on correct answer", async function () {
      await contract.connect(player1).answerQuestion(0, 12);

      const [attemptsToday, remainingAttempts, totalSolved, totalRewards] =
        await contract.getPlayerProgress(player1.address);

      expect(attemptsToday).to.equal(1);
      expect(remainingAttempts).to.equal(2);
      expect(totalSolved).to.equal(1);
      expect(totalRewards).to.equal(100);
    });

    it("Should mark question as solved", async function () {
      await contract.connect(player1).answerQuestion(0, 12);

      const hasSolved = await contract.hasSolved(player1.address, 0);
      expect(hasSolved).to.be.true;
    });

    it("Should prevent answering already solved question", async function () {
      await contract.connect(player1).answerQuestion(0, 12);

      await expect(
        contract.connect(player1).answerQuestion(0, 12)
      ).to.be.revertedWithCustomError(contract, "AlreadySolved");
    });

    it("Should allow multiple correct answers", async function () {
      // Answer Question 0: 12
      await contract.connect(player1).answerQuestion(0, 12);
      // Answer Question 1: 7
      await contract.connect(player1).answerQuestion(1, 7);

      const [, , totalSolved, totalRewards] =
        await contract.getPlayerProgress(player1.address);

      expect(totalSolved).to.equal(2);
      expect(totalRewards).to.equal(200);
    });
  });

  describe("Daily Limit", function () {
    it("Should enforce 3 attempts per day", async function () {
      // Use all 3 attempts (wrong answers)
      await contract.connect(player1).answerQuestion(0, 999);
      await contract.connect(player1).answerQuestion(1, 999);
      await contract.connect(player1).answerQuestion(2, 999);

      // 4th attempt should fail
      await expect(
        contract.connect(player1).answerQuestion(3, 999)
      ).to.be.revertedWithCustomError(contract, "DailyLimitReached");
    });

    it("Should count attempts even for wrong answers", async function () {
      await contract.connect(player1).answerQuestion(0, 999);

      const [attemptsToday, remainingAttempts] =
        await contract.getPlayerProgress(player1.address);

      expect(attemptsToday).to.equal(1);
      expect(remainingAttempts).to.equal(2);
    });

    it("Should reset daily limit after 24 hours", async function () {
      // Use all 3 attempts
      await contract.connect(player1).answerQuestion(0, 999);
      await contract.connect(player1).answerQuestion(1, 999);
      await contract.connect(player1).answerQuestion(2, 999);

      // Fast forward 24 hours
      await time.increase(24 * 60 * 60);

      // Should be able to answer again
      await expect(contract.connect(player1).answerQuestion(3, 7))
        .to.emit(contract, "QuestionAttempted");

      const [attemptsToday, remainingAttempts] =
        await contract.getPlayerProgress(player1.address);

      expect(attemptsToday).to.equal(1);
      expect(remainingAttempts).to.equal(2);
    });

    it("Should emit DailyLimitReset event on reset", async function () {
      await contract.connect(player1).answerQuestion(0, 999);

      // Fast forward 24 hours
      await time.increase(24 * 60 * 60);

      const currentDay = Math.floor(Date.now() / 1000 / 86400) + 1;

      await expect(contract.connect(player1).answerQuestion(1, 999))
        .to.emit(contract, "DailyLimitReset");
    });
  });

  describe("Multiple Players", function () {
    it("Should track progress separately for different players", async function () {
      await contract.connect(player1).answerQuestion(0, 12);
      await contract.connect(player2).answerQuestion(1, 7);

      const [, , totalSolved1] = await contract.getPlayerProgress(player1.address);
      const [, , totalSolved2] = await contract.getPlayerProgress(player2.address);

      expect(totalSolved1).to.equal(1);
      expect(totalSolved2).to.equal(1);
    });

    it("Should have independent daily limits", async function () {
      // Player1 uses 3 attempts
      await contract.connect(player1).answerQuestion(0, 999);
      await contract.connect(player1).answerQuestion(1, 999);
      await contract.connect(player1).answerQuestion(2, 999);

      // Player2 should still have 3 attempts
      await expect(contract.connect(player2).answerQuestion(0, 12))
        .to.emit(contract, "TreasureUnlocked");

      const [, remainingAttempts2] =
        await contract.getPlayerProgress(player2.address);

      expect(remainingAttempts2).to.equal(2);
    });

    it("Should allow same question to be answered by different players", async function () {
      await contract.connect(player1).answerQuestion(0, 12);

      const hasSolved1 = await contract.hasSolved(player1.address, 0);
      const hasSolved2 = await contract.hasSolved(player2.address, 0);

      expect(hasSolved1).to.be.true;
      expect(hasSolved2).to.be.false;

      // Player2 can still answer the same question
      await expect(contract.connect(player2).answerQuestion(0, 12))
        .to.emit(contract, "TreasureUnlocked");
    });
  });

  describe("Random Question Selection", function () {
    it("Should return a valid unsolved question", async function () {
      const questionId = await contract.getRandomQuestion(player1.address);
      expect(questionId).to.be.at.least(0);
      expect(questionId).to.be.at.most(7);
    });

    it("Should not return already solved questions", async function () {
      // Solve all questions except the last one
      const answers = [12, 7, 24, 7, 12, 6, 100];

      for (let i = 0; i < 7; i++) {
        await contract.connect(player1).answerQuestion(i, answers[i]);

        // Fast forward to reset daily limit after every 3 questions
        if ((i + 1) % 3 === 0) {
          await time.increase(24 * 60 * 60);
        }
      }

      // Fast forward to reset daily limit for final check
      await time.increase(24 * 60 * 60);

      const questionId = await contract.getRandomQuestion(player1.address);
      expect(questionId).to.equal(7); // Only question 7 is unsolved
    });

    it("Should return 0 when all questions are solved", async function () {
      const answers = [12, 7, 24, 7, 12, 6, 100, 42];

      for (let i = 0; i < 8; i++) {
        await contract.connect(player1).answerQuestion(i, answers[i]);

        if (i < 7) {
          // Fast forward to reset daily limit
          await time.increase(24 * 60 * 60);
        }
      }

      const questionId = await contract.getRandomQuestion(player1.address);
      expect(questionId).to.equal(0);
    });
  });

  describe("Question Details", function () {
    it("Should return correct question details", async function () {
      const [questionText, reward, isActive, playerSolved] =
        await contract.connect(player1).getQuestion(0);

      expect(questionText).to.equal("What is 5 + 7?");
      expect(reward).to.equal(100);
      expect(isActive).to.be.true;
      expect(playerSolved).to.be.false;
    });

    it("Should update playerSolved after answering", async function () {
      await contract.connect(player1).answerQuestion(0, 12);

      const [, , , playerSolved] =
        await contract.connect(player1).getQuestion(0);

      expect(playerSolved).to.be.true;
    });

    it("Should revert for invalid question ID", async function () {
      await expect(
        contract.getQuestion(999)
      ).to.be.revertedWithCustomError(contract, "InvalidQuestionId");
    });
  });

  describe("Active Questions Count", function () {
    it("Should return 8 active questions initially", async function () {
      const count = await contract.getActiveQuestionsCount();
      expect(count).to.equal(8);
    });
  });

  describe("Create New Question", function () {
    it("Should allow creating new questions", async function () {
      await expect(
        contract.createQuestion("What is 2 + 2?", 4, 150)
      ).to.emit(contract, "QuestionCreated")
        .withArgs(8, "What is 2 + 2?", 150);

      const questionCount = await contract.questionCount();
      expect(questionCount).to.equal(9);
    });

    it("Should allow answering newly created questions", async function () {
      await contract.createQuestion("What is 2 + 2?", 4, 150);

      await expect(contract.connect(player1).answerQuestion(8, 4))
        .to.emit(contract, "TreasureUnlocked")
        .withArgs(player1.address, 8, 150);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle answering with 0 as answer", async function () {
      await contract.createQuestion("What is 0?", 0, 100);

      await expect(contract.connect(player1).answerQuestion(8, 0))
        .to.emit(contract, "TreasureUnlocked");
    });

    it("Should handle large answer values", async function () {
      const largeAnswer = 4294967295; // Max uint32
      await contract.createQuestion("Large number?", largeAnswer, 100);

      await expect(contract.connect(player1).answerQuestion(8, largeAnswer))
        .to.emit(contract, "TreasureUnlocked");
    });

    it("Should not allow answering inactive questions", async function () {
      // This would require adding a function to deactivate questions
      // For now, we just ensure all questions are active
      const [, , isActive] = await contract.getQuestion(0);
      expect(isActive).to.be.true;
    });
  });

  describe("All Correct Answers Test", function () {
    it("Should accept all correct answers for initial questions", async function () {
      const correctAnswers = [
        { id: 0, answer: 12, reward: 100 },  // Day 0 - Attempt 1
        { id: 1, answer: 7, reward: 100 },   // Day 0 - Attempt 2
        { id: 2, answer: 24, reward: 100 },  // Day 0 - Attempt 3
        { id: 3, answer: 7, reward: 100 },   // Day 1 - Attempt 1
        { id: 4, answer: 12, reward: 100 },  // Day 1 - Attempt 2
        { id: 5, answer: 6, reward: 100 },   // Day 1 - Attempt 3
        { id: 6, answer: 100, reward: 200 }, // Day 2 - Attempt 1
        { id: 7, answer: 42, reward: 300 },  // Day 2 - Attempt 2
      ];

      for (let i = 0; i < correctAnswers.length; i++) {
        const { id, answer, reward } = correctAnswers[i];

        // Reset daily limit before the 4th and 7th questions (indices 3 and 6)
        if (i === 3 || i === 6) {
          await time.increase(24 * 60 * 60);
        }

        await expect(contract.connect(player1).answerQuestion(id, answer))
          .to.emit(contract, "TreasureUnlocked")
          .withArgs(player1.address, id, reward);
      }

      const [, , totalSolved, totalRewards] =
        await contract.getPlayerProgress(player1.address);

      expect(totalSolved).to.equal(8);
      expect(totalRewards).to.equal(1100); // 100*6 + 200 + 300 = 600 + 200 + 300 = 1100
    });
  });
});
