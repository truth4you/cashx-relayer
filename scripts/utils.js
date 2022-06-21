const { ethers, upgrades, network } = require("hardhat")
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const fs = require('fs')

const updateABI = async (contractName)=>{
    const abiDir = `${__dirname}/../abi`;
    if (!fs.existsSync(abiDir)) {
        fs.mkdirSync(abiDir);
    }
    const Artifact = artifacts.readArtifactSync(contractName);
    fs.writeFileSync(
        `${abiDir}/${contractName}.json`,
        JSON.stringify(Artifact.abi, null, 2)
    )
}
  
const deploy = async (contractName, ...args)=>{
    const factory = await ethers.getContractFactory(contractName)
    const contract = await factory.deploy(...args)
    await contract.deployed()
    await sleep(1000)
    console.log("deployed", contractName, contract.address)
    await updateABI(contractName)
    if(await verify(contract.address,[...args]))
        console.log("verified", contractName)
    return contract
}
  
const deployProxy = async (contractName, args = [], libraries = {})=>{
    const factory = await ethers.getContractFactory(contractName, { libraries, unsafeAllow:["external-library-linking"] })
    const contract = await upgrades.deployProxy(factory,args)
    await contract.deployed()
    const implAddress = await getImplementationAddress(ethers.provider, contract.address)
    console.log("deployed", contractName, contract.address, implAddress)
    await sleep(1000)
    await updateABI(contractName)
    if(await verify(implAddress))
        console.log("verified", contractName)
    return contract
}
  
const upgradeProxy = async (contractName, contractAddress)=>{
    const factory = await ethers.getContractFactory(contractName)
    const contract = await upgrades.upgradeProxy(contractAddress, factory)
    await contract.deployed()
    const implAddress = await getImplementationAddress(ethers.provider, contract.address)
    console.log("deployed", contractName, contract.address, implAddress)
    await sleep(1000)
    await updateABI(contractName)
    if(await verify(implAddress))
        console.log("verified", contractName)
    return contract
}

const getAt = async (contractName, contractAddress)=>{
    return await ethers.getContractAt(contractName, contractAddress)
}

const verify = async (contractAddress, args = []) => {
    if(network=='localhost' || network=='hardhat') return false
    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
        await sleep(1000)
        return true
    } catch(ex) {
        console.error(ex.message)
        return false
    }
}

const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
    getAt, deploy, deployProxy, upgradeProxy, sleep
}