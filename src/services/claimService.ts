import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { ctfAbi } from '../polymarket/ctfAbi';
import { ENV } from '../config/env';
import fetchData from '../utils/fetchData';
import { execSafeCall } from './safeSdk';

export class ClaimService {
    private provider: ethers.providers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private ctfContract: ethers.Contract;
    private safeContract: ethers.Contract;

    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(ENV.RPC_URL);
        this.signer = new ethers.Wallet(ENV.PRIVATE_KEY, this.provider);
        this.ctfContract = new ethers.Contract(ENV.CTF_TOKEN_ADDRESS, ctfAbi, this.provider);
        this.safeContract = new ethers.Contract(ENV.PROXY_WALLET, [], this.signer);
    }

    async checkAndClaim(clobClient: ClobClient) {
        try {
            const positions: any[] = await fetchData(`https://data-api.polymarket.com/positions?user=${ENV.PROXY_WALLET}&limit=200`);
            const items = await Promise.all((positions || []).map(async (p: any) => {
                const tokenId = p.asset || p.tokenId || p.position_id;
                let conditionId = p.condition_id, closed = !!(p.market?.closed ?? p.closed);
                if ((!conditionId || !closed) && tokenId) { try { const m = await clobClient.getMarket(tokenId); conditionId = conditionId || m.condition_id; closed = closed || !!m.closed; } catch {} }
                return { tokenId, conditionId, closed };
            }));
            const c = items.filter(x => x.tokenId && x.conditionId && x.closed);
            const ids = c.map(x => x.tokenId), acc = Array(ids.length).fill(ENV.PROXY_WALLET);
            const balances = ids.length ? await this.ctfContract.balanceOfBatch(acc, ids) : [];
            for (let i = 0; i < c.length; i++) if (balances[i]?.gt(0)) await this.redeem(c[i].conditionId as string, balances[i]);
            const bal = await this.provider.getBalance(ENV.PROXY_WALLET); if (bal.lt(ethers.utils.parseEther('0.01'))) console.warn('Proxy wallet native balance low');
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

    private async redeem(conditionId: string, _amount?: ethers.BigNumber) {
        const data = this.ctfContract.interface.encodeFunctionData('redeemPositions', [ENV.USDC_CONTRACT_ADDRESS, ethers.constants.HashZero, conditionId, [1, 2]]);
        await execSafeCall(this.signer, ENV.PROXY_WALLET, ENV.CTF_TOKEN_ADDRESS, data);
    }
}
