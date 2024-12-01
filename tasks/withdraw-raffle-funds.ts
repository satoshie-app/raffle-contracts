import { task } from "hardhat/config";
import { WITHDRAW_RAFFLE_FUNDS } from "./task-names";

task(WITHDRAW_RAFFLE_FUNDS, "Withdraws the funds from the raffle")
  .addParam("contract", "The address of the deployed contract")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    // Contract ABI
    const abi = [
      {
        inputs: [],
        name: "withdrawProceeds",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const contractAddress = taskArgs.contract;

    // Get the signer (assumes the first account is used)
    const [signer] = await ethers.getSigners();

    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      const tx = await contract.withdrawProceeds();
      console.log("Transaction sent. Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log(`Raffle funds withdrawn successfully!`);
      console.log(`Transaction hash: ${receipt.hash}`);
    } catch (error) {
      console.error("Failed to withdraw raffle funds:", error);
    }
  });
