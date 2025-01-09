import hre, {
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} from "hardhat";
import {
  SatoshieRaffle,
  SatoshieTickets,
  VRFCoordinatorV2_5Mock,
} from "../../../typechain";
import { setupUser, setupUsers } from "./../accounts";
export interface Contracts {
  SatoshieRaffle: SatoshieRaffle;
  SatoshieTickets: SatoshieTickets;
  VRFCoordinatorV2_5Mock: VRFCoordinatorV2_5Mock;
}

export interface User extends Contracts {
  address: string;
}

export interface RaffleData {
  ticketPrice: bigint;
  platformFee: bigint;
  prizeAmount: bigint;
  endDate: number;
  satoshiesWallet: `0x${string}`;
}

export const setupIntegration = deployments.createFixture(
  async ({ ethers }) => {
    const { deployer, deployerMultisig, admin } = await getNamedAccounts();

    const WHALE_ACCOUNT = process.env.WHALE_ADDRESS;
    if (!WHALE_ACCOUNT) {
      throw new Error("WHALE_ADDRESS is not set");
    }
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ACCOUNT],
    });

    await hre.network.provider.send("hardhat_setBalance", [
      WHALE_ACCOUNT,
      ethers.hexlify(ethers.toUtf8Bytes(ethers.parseEther("10.0").toString())),
    ]);

    const whale = await ethers.provider.getSigner(WHALE_ACCOUNT);

    await whale.sendTransaction({
      to: deployer,
      value: ethers.parseEther("10.0"),
    });
    await whale.sendTransaction({
      to: deployerMultisig,
      value: ethers.parseEther("10.0"),
    });
    await whale.sendTransaction({
      to: admin,
      value: ethers.parseEther("10.0"),
    });

    await deployments.fixture(["DeploySatoshieRaffle"]);

    const raffleData = {
      ticketPrice: ethers.parseEther("0.01"),
      platformFee: ethers.parseEther("0.2"),
      prizeAmount: ethers.parseEther("1"),
      // endDate: parseInt(
      //   (new Date("2025-02-02T11:48:57.000Z").getTime() / 1000).toFixed(0)
      // ),
      endDate: parseInt(
        ((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000).toFixed(0)
      ), // 30 days into the future
      vrfKeyHash: process.env.VRF_KEY_HASH_ARBITRUM_SEPOLIA as string, // "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"; // example key hash
      vrfBaseFee: "1000000000000000", // 0.001 ether as base fee
      vrfGasPriceLink: "50000000000", // 50 gwei
      satoshiesWallet: process.env.SATOSHIES_WALLET as `0x${string}`,
    };

    // *********** NFT Ticket SETUP ***********
    const ERC721 = await ethers.getContractFactory("SatoshieTickets");

    const erc721Tickets = await ERC721.deploy("Raff Tickets", "RAFF");
    await erc721Tickets.waitForDeployment();
    const ERC721_RAFF_TICKETS = erc721Tickets.target;

    // *********** VRF SETUP ***********

    // Deploy the VRFCoordinatorV2_5Mock
    const VRF = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
    const VRFCoordinatorV2_5Mock = await VRF.deploy(
      raffleData.vrfBaseFee, // Base fee
      raffleData.vrfGasPriceLink, // Gas price link
      "3000000000000000000" // We per unit link
    );

    // *********** RAFFLE SETUP ***********

    const vrfCoordinator = VRFCoordinatorV2_5Mock.target;
    // CONTRACT SETUP: raffle  contract
    const SatoshieContractFactory = await ethers.getContractFactory(
      "SatoshieRaffle"
    );

    const SatoshieRaffle = await SatoshieContractFactory.deploy(
      admin,
      raffleData.ticketPrice,
      raffleData.endDate,
      ERC721_RAFF_TICKETS,
      vrfCoordinator,
      raffleData.vrfKeyHash,
      raffleData.platformFee,
      raffleData.prizeAmount,
      raffleData.satoshiesWallet
    );

    console.log(`
      starting contracts \n 
      raffle contract: ${SatoshieRaffle.target} \n   
      erc721: ${ERC721_RAFF_TICKETS} \n            
      admin: ${admin} \n            
      ticket price: ${raffleData.ticketPrice} \n            
      goal: ${raffleData.platformFee + raffleData.prizeAmount} \n   
      platform fee: ${raffleData.platformFee} \n
      prize amount: ${raffleData.prizeAmount} \n
      end date: ${raffleData.endDate} \n     
      vrfCoordinator: ${vrfCoordinator} \n
      vrfKeyHash: ${raffleData.vrfKeyHash} \n
      `);

    // *********** UPDATE NFT CONTRACT ***********
    // we need to give the raffle contract minting privs on the nft contract so that only it can mint
    await erc721Tickets.setRaffleContract(SatoshieRaffle.target);

    const contracts: Contracts = {
      SatoshieRaffle: SatoshieRaffle,
      SatoshieTickets: erc721Tickets,
      VRFCoordinatorV2_5Mock: VRFCoordinatorV2_5Mock,
    };

    const users: User[] = await setupUsers(
      await getUnnamedAccounts(),
      contracts
    );

    return {
      raffleData,
      contracts,
      deployer: <User>await setupUser(deployer, contracts),
      deployerMultisig: <User>await setupUser(deployerMultisig, contracts),
      admin: <User>await setupUser(admin, contracts),
      users,
    };
  }
);
