import createClobClient from '../utils/createClobClient';
import { AssetType } from '@polymarket/clob-client';

const main = async () => {
    console.log("Initializing CLOB Client...");
    try {
        const client = await createClobClient();
        console.log("Client initialized.");
        
        console.log("Attempting to approve USDC (Collateral) for Proxy Wallet...");
        // This will check allowance and approve if necessary
        // It should handle the Gnosis Safe transaction if configured with Proxy
        const tx = await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        
        console.log("Approve transaction sent/completed.");
        console.log("Result:", tx);
        
    } catch (err) {
        console.error("Error during approval process:", err);
    }
};

main();
