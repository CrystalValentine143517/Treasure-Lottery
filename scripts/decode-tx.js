const hre = require("hardhat");

async function main() {
  const txHash = "0x5212e79c36623263b31e50b482ec20b9e1943538cebc916f375decc3550e1551";

  const tx = await hre.ethers.provider.getTransaction(txHash);
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);

  console.log("Transaction Details:");
  console.log("  To:", tx.to);
  console.log("  From:", tx.from);
  console.log("  Data:", tx.data.substring(0, 66));

  console.log("\nTransaction Receipt:");
  console.log("  Status:", receipt.status);
  console.log("  Logs count:", receipt.logs.length);

  console.log("\nAll Logs:");
  receipt.logs.forEach((log, index) => {
    console.log(`\nLog ${index}:`);
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics);
    console.log("  Data:", log.data);
  });

  // Decode input
  const QuestionTreasureBox = await hre.ethers.getContractFactory("QuestionTreasureBox");
  const iface = QuestionTreasureBox.interface;

  try {
    const decoded = iface.parseTransaction({ data: tx.data });
    console.log("\nDecoded Function Call:");
    console.log("  Function:", decoded.name);
    console.log("  Args:", decoded.args);
  } catch (e) {
    console.log("\nCould not decode function call");
  }

  // Try to decode logs
  console.log("\n\nDecoding Logs:");
  receipt.logs.forEach((log, index) => {
    if (log.address.toLowerCase() === tx.to.toLowerCase()) {
      try {
        const parsed = iface.parseLog(log);
        console.log(`\nLog ${index} - ${parsed.name}:`);
        console.log("  Args:", parsed.args);
      } catch (e) {
        console.log(`\nLog ${index} - Could not decode (not from our contract)`);
      }
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
