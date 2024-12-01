import { task } from "hardhat/config";

import { VERIFCONTRACTS } from "./task-names";

task(VERIFCONTRACTS, "Verifies the contracts", async (_taskArgs, hre) => {
  const { deployments, upgrades } = hre;

  let contractImpl = await upgrades.erc1967.getImplementationAddress(
    (
      await deployments.get("SatoshieRaffle")
    ).address
  );

  try {
    await hre.run("verify:verify", {
      address: contractImpl,
      constructorArguments: [],
    });
  } catch (e: any) {
    // @ts-ignore
    if (
      e.name === "NomicLabsHardhatPluginError" &&
      e.message.indexOf("Contract source code already verified") !== -1
    ) {
      console.log("Contract source already verified!");
    } else {
      console.log(e);
    }
  }
});
