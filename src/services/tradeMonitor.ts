import EventEmitter from 'events';
import { ENV } from '../config/env';
import fetchData from '../utils/fetchData';
import { TradeData } from '../interfaces/tradeInterfaces';

interface PolymarketEvent {
    id: string;
    type: string;
    hash?: string;
    transactionHash?: string;
    blockNumber?: number;
    timestamp?: number;
    market?: string;
    asset?: string;
    side?: string;
    outcome?: string;
    outcomeIndex?: number;
    price?: number;
    amount?: number;
    size?: number;
    value?: number;
    maker?: string;
    taker?: string;
}

class TradeMonitor extends EventEmitter {
    private fetchInterval: number;
    private isRunning: boolean;
    private seenTransactions: Set<string>;

    constructor() {
        super();
        this.fetchInterval = ENV.FETCH_INTERVAL || 10;
        this.isRunning = false;
        this.seenTransactions = new Set();
    }

    public start(targetWallets: string[]) {
        if (this.isRunning) {
            console.log('TradeMonitor is already running.');
            return;
        }
        
        this.isRunning = true;
        console.log(`Starting TradeMonitor for wallets: ${targetWallets.join(', ')}`);
        
        // Start the polling loop
        this.monitorLoop(targetWallets);
    }

    public stop() {
        this.isRunning = false;
        console.log('Stopping TradeMonitor...');
    }

    private async monitorLoop(wallets: string[]) {
        while (this.isRunning) {
            for (const wallet of wallets) {
                await this.checkWallet(wallet);
            }
            // Wait for the interval before next cycle
            await new Promise((resolve) => setTimeout(resolve, this.fetchInterval * 1000));
        }
    }

    private async checkWallet(wallet: string) {
        try {
            // Fetch events for the user
            // using data-api.polymarket.com/activity which returns trade history
            const url = `https://data-api.polymarket.com/activity?user=${wallet}&limit=20`;
            
            // Assuming fetchData returns an array of events
            const events: any[] = await fetchData(url);

            if (!events || !Array.isArray(events)) {
                return;
            }

            // Process events
            // The API returns newest first, so we should iterate in reverse if we want to process strictly in order,
            // but for real-time monitoring, we just want to catch new ones. 
            // However, to avoid missing something if we fetch frequently, we iterate normally.
            for (const event of events) {
                // Filter for TRADE type only
                if (event.type === 'TRADE') {
                    // Check timestamp (ENV.TOO_OLD_TIMESTAMP is in seconds)
                    if (event.timestamp) {
                        const eventTime = event.timestamp * 1000; 
                        const now = Date.now();
                        const maxAge = (ENV.TOO_OLD_TIMESTAMP || 3600) * 1000;
                        
                        if (now - eventTime > maxAge) {
                            // console.log(`Skipping old event ${event.hash || event.transactionHash} from ${new Date(eventTime).toISOString()}`);
                            continue;
                        }
                    }
                    await this.processEvent(event, wallet);
                }
            }

        } catch (error) {
            console.error(`Error monitoring wallet ${wallet}:`, error);
        }
    }

    private async processEvent(event: any, wallet: string) {
        // We need a unique identifier for the transaction to avoid duplicates
        // transactionHash is the best candidate.
        const txHash = event.transactionHash || event.hash;
        
        if (!txHash) return;

        if (this.seenTransactions.has(txHash)) {
            return;
        }

        // Mark as seen
        this.seenTransactions.add(txHash);
        
        // Keep the Set size manageable
        if (this.seenTransactions.size > 1000) {
            const iterator = this.seenTransactions.values();
            const firstVal = iterator.next().value;
            if (typeof firstVal === 'string') {
                this.seenTransactions.delete(firstVal);
            }
        }

        console.log(`[!] New transaction found: ${txHash}`);

        // Map event to TradeData
        try {
            const tradeData: TradeData = {
                blockNumber: event.blockNumber || 0,
                transactionHash: txHash,
                tokenId: event.asset, // Data API returns 'asset' as tokenID
                side: this.parseSide(event.side),
                makerAmount: parseFloat(event.size || '0'), // size is outcome tokens
                takerAmount: parseFloat(event.usdcSize || '0') // usdcSize is input amount
            };

            // Basic validation
            if (!tradeData.tokenId) {
                // console.warn(`Skipping event ${txHash} due to missing tokenId`);
                return; 
            }

            // Emit the event
            this.emit('transaction', tradeData);

        } catch (err) {
            console.error(`Error parsing event ${txHash}:`, err);
        }
    }

    private parseSide(side: string | number): number {
        if (typeof side === 'string') {
            return side.toUpperCase() === 'BUY' ? 0 : 1;
        }
        return side === 0 ? 0 : 1;
    }
}

export default TradeMonitor;
