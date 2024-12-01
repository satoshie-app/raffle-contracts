import { task } from "hardhat/config";
import { ENABLE_RAFFLE } from "./task-names";

task(ENABLE_RAFFLE, "Sets the enabled status of the raffle")
  .addParam("contract", "The address of the deployed contract")
  .addParam("enabled", "Set to true to enable or false to disable the raffle")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    // Contract ABI
    const abi = [
      {
        inputs: [{ internalType: "bool", name: "_enabled", type: "bool" }],
        name: "setEnabled",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const contractAddress = taskArgs.contract;
    const enabled = taskArgs.enabled.toLowerCase() === "true"; // Convert string to boolean

    // Get the signer (assumes the first account is used)
    const [signer] = await ethers.getSigners();

    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, abi, signer);

    console.log(
      `${
        enabled ? "Enabling" : "Disabling"
      } raffle on contract at ${contractAddress}...`
    );

    try {
      // Call the setEnabled function
      const tx = await contract.setEnabled(enabled);
      console.log("Transaction sent. Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log(`Raffle ${enabled ? "enabled" : "disabled"} successfully!`);
      console.log(`Transaction hash: ${receipt.hash}`);
    } catch (error) {
      console.error("Failed to set enabled status:", error);
    }
  });
