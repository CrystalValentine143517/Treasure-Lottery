const hre = require("hardhat");

async function main() {
  const contractAddress = "0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB";
  const playerAddress = process.env.PLAYER_ADDRESS || "0x3C8F29398Fb56ad34C1ac424710053Db3c494996";

  const QuestionTreasureBox = await hre.ethers.getContractFactory("QuestionTreasureBox");
  const contract = QuestionTreasureBox.attach(contractAddress);

  console.log("Checking player:", playerAddress);
  console.log("Contract:", contractAddress, "\n");

  const [attemptsToday, remainingAttempts, totalSolved, totalRewards, timeUntilReset] =
    await contract.getPlayerProgress(playerAddress);

  console.log("Player Progress:");
  console.log("  Attempts used today:", attemptsToday.toString());
  console.log("  Remaining attempts:", remainingAttempts.toString());
  console.log("  Total solved:", totalSolved.toString());
  console.log("  Total rewards:", totalRewards.toString());
  console.log("  Time until reset:", timeUntilReset.toString(), "seconds");

  console.log("\nChecking if solved Question 4...");
  const hasSolved4 = await contract.hasSolved(playerAddress, 4);
  console.log("  Solved Question 4:", hasSolved4);

  console.log("\nAll solved questions:");
  for (let i = 0; i < 8; i++) {
    const solved = await contract.hasSolved(playerAddress, i);
    if (solved) {
      const [questionText] = await contract.getQuestion(i);
      console.log(`  Question ${i}: ${questionText}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
