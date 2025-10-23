const hre = require("hardhat");

async function main() {
  const contractAddress = "0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB";

  const QuestionTreasureBox = await hre.ethers.getContractFactory("QuestionTreasureBox");
  const contract = QuestionTreasureBox.attach(contractAddress);

  console.log("Checking Question ID 4...\n");

  // Get question text
  const [questionText, reward, isActive] = await contract.getQuestion(4);
  console.log("Question Text:", questionText);
  console.log("Reward:", reward.toString());
  console.log("Active:", isActive);

  // Read the storage slot to check plaintext answer
  // Question struct: string, euint32, uint32, uint64, bool, uint256
  // Storage layout for mapping: keccak256(key . slot)
  const questionSlot = 0; // questions mapping is at slot 0
  const storageKey = hre.ethers.solidityPackedKeccak256(["uint256", "uint256"], [4, questionSlot]);

  console.log("\nTrying to read storage...");

  // Simulate answering with 12
  const [signer] = await hre.ethers.getSigners();
  console.log("\nSimulating answer with value 12...");

  try {
    // Call staticCall to simulate without sending transaction
    await contract.answerQuestion.staticCall(4, 12);
    console.log("✅ Answer 12 would be CORRECT");
  } catch (error) {
    console.log("❌ Answer 12 would be WRONG");
    console.log("Error:", error.message);
  }

  console.log("\nSimulating answer with value 7...");
  try {
    await contract.answerQuestion.staticCall(4, 7);
    console.log("✅ Answer 7 would be CORRECT");
  } catch (error) {
    console.log("❌ Answer 7 would be WRONG");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
