const { ethers, waffle, upgrades} = require("hardhat");
const { deploy, deployProxy, upgradeProxy } = require('./utils')


async function main() {

    const [owner] = await ethers.getSigners();
    console.log(
        "Deploying the contracts with the account:",
        owner.address
    );

    console.log("Account balance:", (await owner.getBalance()).toString());
    
    await upgradeProxy("NodeManager", "0x809Bd9981FC89C6f8d91EcEda90238fE19ac84f1")
    const FeeManager = await upgradeProxy("FeeManager", "0xd31440dFd16D60AC9fa3FE36a94Ef4d9F2385F9f")
    await (await FeeManager.setRateUpgradeFee("basic", "light", 1000)).wait()
    await (await FeeManager.setRateUpgradeFee("basic", "pro", 1500)).wait()
    await (await FeeManager.setRateUpgradeFee("light", "pro", 1000)).wait()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});
