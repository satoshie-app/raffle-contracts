import { ethers } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  // Get named accounts
  const { deployer, admin } = await getNamedAccounts();

  console.log("Deploying contracts with the account:", deployer);

  // Get VRF configuration from environment variables
  const vrfCoordinator = process.env.VRF_COORDINATOR_ADDRESS_ARBITRUM_SEPOLIA;
  const vrfKeyHash = process.env.VRF_KEY_HASH_ARBITRUM_SEPOLIA;
  const vrfSubscriptionId = process.env.VRF_SUBSCRIPTION_ID_ARBITRUM_SEPOLIA;
  const satoshiesWallet = process.env.SATOSHIES_WALLET;

  console.log(`
    vrfCoordinator: ${vrfCoordinator} \n
    vrfKeyHash: ${vrfKeyHash} \n  
    vrfSubscriptionId: ${vrfSubscriptionId} \n
    satoshiesWallet: ${satoshiesWallet} \n
    `);

  if (
    !vrfCoordinator ||
    !vrfKeyHash ||
    !vrfSubscriptionId ||
    !satoshiesWallet
  ) {
    throw new Error(
      "Missing VRF or wallet configuration in environment variables"
    );
  }

  // Get contract parameters from environment variables
  const ticketPrice = ethers.parseEther(process.env.TICKET_PRICE || "0.01");
  const platformFee = ethers.parseEther(process.env.PLATFORM_FEE || "0.2");
  const prizeAmount = ethers.parseEther(process.env.PRIZE_AMOUNT || "1");

  // Calculate end date (e.g., 30 days from now)
  const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // First deploy the NFT Ticket contract
  console.log("Deploying SatoshieTickets...");
  const ticketContract = await deploy("SatoshieTickets", {
    from: deployer,
    args: ["Satoshie Raffle Tickets", "SRAFF"], // Constructor args: name and symbol
    log: true,
    waitConfirmations: 1,
  });

  console.log("SatoshieTickets deployed to:", ticketContract.address);

  // Deploy SatoshieRaffle
  console.log("Deploying SatoshieRaffle...");
  const raffleContract = await deploy("SatoshieRaffle", {
    from: deployer,
    args: [
      admin,
      ticketPrice,
      endDate,
      ticketContract.address,
      vrfCoordinator,
      vrfKeyHash,
      platformFee,
      prizeAmount,
      satoshiesWallet,
    ],
    log: true,
    waitConfirmations: 1,
  });

  console.log("SatoshieRaffle deployed to:", raffleContract.address);

  // Set up the raffle contract address in the ticket contract
  console.log("Setting up raffle contract in ticket contract...");
  const ticketContractInstance = await hre.ethers.getContractAt(
    "SatoshieTickets",
    ticketContract.address
  );

  const setRaffleTx = await ticketContractInstance.setRaffleContract(
    raffleContract.address
  );
  await setRaffleTx.wait(1);

  // Set up VRF subscription ID in the raffle contract
  console.log("Setting up VRF subscription...");
  const raffleContractInstance = await hre.ethers.getContractAt(
    "SatoshieRaffle",
    raffleContract.address
  );

  const setSubIdTx = await raffleContractInstance.setSubscriptionId(
    vrfSubscriptionId
  );
  await setSubIdTx.wait(1);

  console.log(`Deployment completed: \n\n`);
  console.log("ticketsContract:", `"${ticketContract.address}"`);
  console.log("raffleContract:", `"${raffleContract.address}" \n\n`);
  console.log("Admin Address:", admin);
  console.log("VRF Coordinator:", vrfCoordinator);
  console.log("Subscription ID:", vrfSubscriptionId);

  // Verify contracts if not on a local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Verifying contracts...");
    try {
      await hre.run("verify:verify", {
        address: ticketContract.address,
        constructorArguments: ["Satoshie Raffle Tickets", "SRAFF"],
      });

      await hre.run("verify:verify", {
        address: raffleContract.address,
        constructorArguments: [
          admin,
          ticketPrice,
          endDate,
          ticketContract.address,
          vrfCoordinator,
          vrfKeyHash,
          platformFee,
          prizeAmount,
          satoshiesWallet,
        ],
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }

  return true;
};

export default func;
func.id = "deploy_raffle_system_arb_sepolia";
func.tags = ["dev_raffle", "SatoshieTickets"];
