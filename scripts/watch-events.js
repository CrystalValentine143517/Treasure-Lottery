const hre = require("hardhat");

async function main() {
  const contractAddress = "0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB";

  const QuestionTreasureBox = await hre.ethers.getContractFactory("QuestionTreasureBox");
  const contract = QuestionTreasureBox.attach(contractAddress);

  console.log("Watching for events on contract:", contractAddress);
  console.log("Press Ctrl+C to stop\n");

  // Listen for QuestionAttempted events
  contract.on("QuestionAttempted", (player, questionId, success, event) => {
    console.log("\n📝 QuestionAttempted Event:");
    console.log("  Player:", player);
    console.log("  Question ID:", questionId.toString());
    console.log("  Success:", success);
    console.log("  Block:", event.log.blockNumber);
  });

  // Listen for TreasureUnlocked events
  contract.on("TreasureUnlocked", (player, questionId, reward, event) => {
    console.log("\n🎉 TreasureUnlocked Event:");
    console.log("  Player:", player);
    console.log("  Question ID:", questionId.toString());
    console.log("  Reward:", reward.toString());
    console.log("  Block:", event.log.blockNumber);
  });

  // Keep the script running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
