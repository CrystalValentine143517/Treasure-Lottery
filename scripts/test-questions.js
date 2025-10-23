const hre = require("hardhat");

async function main() {
  const contractAddress = "0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB";

  const QuestionTreasureBox = await hre.ethers.getContractFactory("QuestionTreasureBox");
  const contract = QuestionTreasureBox.attach(contractAddress);

  console.log("Testing QuestionTreasureBox contract...\n");

  const questionCount = await contract.questionCount();
  console.log("Total questions:", questionCount.toString());

  console.log("\nListing all questions:");
  for (let i = 0; i < questionCount; i++) {
    const [questionText, reward, isActive] = await contract.getQuestion(i);
    console.log(`\nQuestion ${i}:`);
    console.log(`  Text: ${questionText}`);
    console.log(`  Reward: ${reward.toString()}`);
    console.log(`  Active: ${isActive}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
