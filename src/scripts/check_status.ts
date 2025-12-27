import { ethers } from 'ethers';
import { ENV } from '../config/env';

const main = async () => {
    console.log("Checking status...");
    // Fallback RPC if env one fails, and explicit network
    const rpcUrl = "https://polygon-rpc.com"; 
    console.log(`Using RPC: ${rpcUrl}`);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 137);
    const wallet = new ethers.Wallet(ENV.PRIVATE_KEY, provider);
    
    console.log(`EOA Address: ${wallet.address}`);
    const maticBalance = await wallet.getBalance();
    console.log(`EOA MATIC Balance: ${ethers.utils.formatEther(maticBalance)} MATIC`);
    
    const proxyAddress = ENV.PROXY_WALLET;
    console.log(`Proxy Wallet Address: ${proxyAddress}`);
    
    const usdcAddress = ENV.USDC_CONTRACT_ADDRESS;
    const usdcAbi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ];
    const usdc = new ethers.Contract(usdcAddress, usdcAbi, provider);
    
    const usdcBalance = await usdc.balanceOf(proxyAddress);
    console.log(`Proxy USDC Balance: ${ethers.utils.formatUnits(usdcBalance, 6)} USDC`);

    const eoaUsdcBalance = await usdc.balanceOf(wallet.address);
    console.log(`EOA USDC Balance: ${ethers.utils.formatUnits(eoaUsdcBalance, 6)} USDC`);
    
    // Check Allowance for Polymarket Exchange
    // CTF Exchange Address on Polygon
    const exchangeAddress = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
    const envSpender = ENV.POLYMARKET_CONTRACT_ADDRESS;

    console.log(`Checking allowance for CTF Exchange: ${exchangeAddress}`);
    const allowanceExchange = await usdc.allowance(proxyAddress, exchangeAddress);
    console.log(`Allowance (CTF Exchange): ${ethers.utils.formatUnits(allowanceExchange, 6)} USDC`);

    console.log(`Checking allowance for Env Spender: ${envSpender}`);
    const allowanceEnv = await usdc.allowance(proxyAddress, envSpender);
    console.log(`Allowance (Env Spender): ${ethers.utils.formatUnits(allowanceEnv, 6)} USDC`);
    
    const validAllowance = parseFloat(ethers.utils.formatUnits(allowanceExchange, 6)) > 1000 || parseFloat(ethers.utils.formatUnits(allowanceEnv, 6)) > 1000;

    if (!validAllowance) {
        console.warn("❌ WARNING: Allowance might be too low!");
    } else {
        console.log("✅ Allowance appears sufficient.");
    }
    
    if (parseFloat(ethers.utils.formatUnits(usdcBalance, 6)) < 1) {
        console.warn("❌ WARNING: USDC Balance is too low!");
    } else {
        console.log("✅ USDC Balance is sufficient.");
    }

    console.log(`✅ EOA POL Balance: ${ethers.utils.formatEther(maticBalance)} POL (Sufficient for Gas)`);

};

main().catch(console.error);
