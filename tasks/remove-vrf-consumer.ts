import { task } from "hardhat/config";

task(
  "remove-consumer",
  "Removes a consumer contract from a Chainlink VRF subscription"
)
  .addParam("vrfCoordinator", "The address of the VRF Coordinator contract")
  .addParam("subscriptionId", "The ID of the VRF subscription")
  .addParam("consumer", "The address of the consumer contract")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    // Define the ABI for the `removeConsumer` method
    const vrfCoordinatorAbi = [
      {
        inputs: [
          { internalType: "uint256", name: "subId", type: "uint256" },
          { internalType: "address", name: "consumer", type: "address" },
        ],
        name: "removeConsumer",
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
        `Removing consumer ${consumer} from subscription ${subscriptionId}...`
      );

      // Call the `removeConsumer` function
      const tx = await vrfCoordinatorContract.removeConsumer(
        subscriptionId,
        consumer
      );

      console.log("Transaction sent. Waiting for confirmation...");
      const receipt = await tx.wait();

      console.log("Consumer removed successfully!");
      console.log(`Transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
      console.error("Failed to remove consumer:", error);
    }
  });
