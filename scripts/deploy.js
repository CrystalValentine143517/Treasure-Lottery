const hre = require("hardhat");

async function main() {
  console.log("Deploying QuestionTreasureBox contract to Sepolia...");
  console.log("FHE-powered Q&A treasure box with daily limits!\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const QuestionTreasureBox = await hre.ethers.getContractFactory("QuestionTreasureBox");
  console.log("\nDeploying contract...");
  
  const treasureBox = await QuestionTreasureBox.deploy();
  await treasureBox.waitForDeployment();

  const contractAddress = await treasureBox.getAddress();
  console.log("\n✅ QuestionTreasureBox deployed to:", contractAddress);

  console.log("\nWaiting for 5 block confirmations...");
  await treasureBox.deploymentTransaction().wait(5);

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract Address:", contractAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network: Sepolia Testnet");
  console.log("\n🔐 FHE Features:");
  console.log("  • Encrypted answers using FHE");
  console.log("  • Homomorphic comparison for verification");
  console.log("  • 8 pre-created questions:");
  console.log("    - Math questions (100 coins each)");
  console.log("    - Riddles (100 coins each)");
  console.log("    - Bonus questions (200-300 coins)");
  console.log("\n🎮 Game Rules:");
  console.log("  • Daily limit: 3 attempts per address");
  console.log("  • Auto-resets every 24 hours");
  console.log("  • Random question selection");
  console.log("  • Plaintext rewards after correct answer");
  console.log("\n🔗 Next Steps:");
  console.log("  1. Update frontend contract address in:");
  console.log("     frontend/src/config/contract.ts");
  console.log("  2. Verify on Etherscan:");
  console.log("     npx hardhat verify --network sepolia " + contractAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
