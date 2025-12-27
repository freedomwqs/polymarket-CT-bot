import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { ctfAbi } from '../polymarket/ctfAbi';
import { safeAbi } from '../polymarket/safeAbi';
import { ENV } from '../config/env';

// Standard Gnosis Safe Interface
const SAFE_INTERFACE = new ethers.utils.Interface(safeAbi);
// CTF Interface
const CTF_INTERFACE = new ethers.utils.Interface(ctfAbi);

const INDEX_SETS = [1, 2]; // For binary markets (Yes/No)

export class ClaimService {
    private provider: ethers.providers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private ctfContract: ethers.Contract;
    private safeContract: ethers.Contract;

    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(ENV.RPC_URL);
        this.signer = new ethers.Wallet(ENV.PRIVATE_KEY, this.provider);
        this.ctfContract = new ethers.Contract(ENV.CTF_TOKEN_ADDRESS, ctfAbi, this.provider);
        this.safeContract = new ethers.Contract(ENV.PROXY_WALLET, safeAbi, this.signer);
    }

    async checkAndClaim(clobClient: ClobClient) {
        console.log('Starting automated claim check...');

        try {
            // 1. Get recent trades to identify potential markets
            // Note: clob-client getTrades returns a list of trades.
            // We'll limit to last 100 to avoid overloading
            const trades = await clobClient.getTrades({
                limit: "100", // limit might be string in some versions
                maker_address: ENV.PROXY_WALLET // Filter by our proxy
            } as any);

            const uniqueTokenIds = [...new Set(trades.map((t: any) => t.asset_id))];
            console.log(`Found ${uniqueTokenIds.length} unique assets in recent history.`);

            for (const tokenId of uniqueTokenIds) {
                await this.processToken(clobClient, tokenId);
            }

        } catch (error) {
            console.error('Error in claim process:', error);
        }
    }

    private async processToken(clobClient: ClobClient, tokenId: string) {
        try {
            // Get Market Details
            const market = await clobClient.getMarket(tokenId);
            
            // Check if market is closed/resolved
            if (!market.closed) {
                // Market is still active, skip
                return;
            }

            console.log(`Checking resolved market: ${market.question} (${tokenId})`);

            // Check Balance in CTF
            // We need the Condition ID.
            const conditionId = market.condition_id;
            
            // Check balances for both outcomes (Index 1 and 2 usually)
            // Note: Polymarket CTF usually uses index sets.
            // Position ID = keccak256(abi.encodePacked(collateralToken, collectionId))
            // Collection ID = keccak256(abi.encodePacked(conditionId, indexSet))
            
            // We need to check balances for the specific Token ID.
            // Actually, the Token ID *is* the Position ID in ERC1155 context for the CTF?
            // Let's assume tokenId IS the asset ID for the CTF balance check.
            
            const balance = await this.ctfContract.balanceOf(ENV.PROXY_WALLET, tokenId);
            
            if (balance.gt(0)) {
                console.log(`Found winning position! Token: ${tokenId}, Balance: ${ethers.utils.formatUnits(balance, 6)}`);
                await this.redeem(conditionId, balance);
            } else {
                // Check the sibling token?
                // Often we might hold the losing token, which is worthless.
                // Or we held the winning one but already sold/redeemed.
            }

        } catch (error) {
            console.error(`Error processing token ${tokenId}:`, error);
        }
    }

    private async redeem(conditionId: string, amount: ethers.BigNumber) {
        console.log(`Attempting to redeem for condition: ${conditionId}`);

        try {
            // 1. Prepare Data for redeemPositions
            // redeemPositions(IERC20 collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint[] indexSets)
            const collateralToken = ENV.USDC_CONTRACT_ADDRESS;
            const parentCollectionId = ethers.constants.HashZero;
            const indexSets = [1, 2]; // Redeem both slots (standard for binary)

            const data = CTF_INTERFACE.encodeFunctionData('redeemPositions', [
                collateralToken,
                parentCollectionId,
                conditionId,
                indexSets
            ]);

            // 2. Prepare Safe Transaction
            // execTransaction(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures)
            
            const to = ENV.CTF_TOKEN_ADDRESS;
            const value = 0;
            const operation = 0; // Call
            const safeTxGas = 0; // standard for simple calls
            const baseGas = 0;
            const gasPrice = 0;
            const gasToken = ethers.constants.AddressZero;
            const refundReceiver = ethers.constants.AddressZero;
            const nonce = await this.safeContract.nonce();

            const transactionHash = await this.safeContract.getTransactionHash(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                nonce
            );

            // 3. Sign
            // For a 1-owner Safe, we sign the hash.
            // Note: This signature format depends on Safe version. 
            // Standard EOA signature: {bytes32 r}{bytes32 s}{uint8 v}
            // v should be +4 to indicate EOA? 
            // Or just signMessage.
            
            const signature = await this.signer.signMessage(ethers.utils.arrayify(transactionHash));
            
            // Adjust v for Safe (v += 4 if using eth_sign?)
            // Actually, for Gnosis Safe, signature needs to be formatted.
            // For a single signer safe, we can use the signature directly, BUT we might need to adjust 'v'
            // The safe expects r, s, v where v is 27 or 28 (or + chainId logic for EIP155)
            // ethers.signMessage produces a signature with v=27/28.
            // However, Gnosis Safe `execTransaction` often requires v to be adjusted for "EthSign" type signatures if using signMessage.
            // Or if we signed the hash directly.
            // Let's try to adjust the signature.
            
            let sig = ethers.utils.splitSignature(signature);
            // If v is 27/28, add 4 to make it 31/32 for Safe's "eth_sign" flow?
            // Actually, for EIP-191 signed messages (which signMessage does), Safe usually accepts it if we set v += 4.
            // Standard EOA signature: v = 27 or 28.
            // Safe Approved Hash: v = 1.
            // Contract Signature: v = 0.
            // EthSign (e.g. signMessage): v > 30.
            
            if (sig.v < 30) {
                 sig.v += 4;
            }
            
            const adjustedSignature = ethers.utils.joinSignature(sig);

            console.log('Sending execution transaction...');
            
            const tx = await this.safeContract.execTransaction(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                adjustedSignature // Use adjusted signature
            );

            console.log(`Redemption TX Sent: ${tx.hash}`);
            await tx.wait();
            console.log('Redemption Confirmed!');

        } catch (error) {
            console.error('Redemption failed:', error);
        }
    }
}
