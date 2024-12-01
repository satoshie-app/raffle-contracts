import { task } from "hardhat/config";

task("add-consumer", "Adds a consumer contract to a Chainlink VRF subscription")
  .addParam("vrfCoordinator", "The address of the VRF Coordinator contract")
  .addParam("subscriptionId", "The ID of the VRF subscription")
  .addParam("consumer", "The address of the consumer contract")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const vrfCoordinatorAbi = [
      {
        inputs: [
          { internalType: "uint256", name: "subId", type: "uint256" },
          { internalType: "address", name: "consumer", type: "address" },
        ],
        name: "addConsumer",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const { vrfCoordinator, subscriptionId, consumer } = taskArgs;

    // Get the signer (assumes the first account is used)
    const [signer] = await ethers.getSigners();

    // Create a contract instance
    const vrfCoordinatorContract = new ethers.Contract(
      vrfCoordinator,
      vrfCoordinatorAbi,
      signer
    );

    try {
      console.log(
        `Adding consumer ${consumer} to subscription ${subscriptionId}...`
      );

      const tx = await vrfCoordinatorContract.addConsumer(
        subscriptionId,
        consumer
      );

      console.log("Transaction sent. Waiting for confirmation...");
      const receipt = await tx.wait();

      console.log("Consumer added successfully!");
      console.log(`Transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
      console.error("Failed to add consumer:", error);
    }
  });
