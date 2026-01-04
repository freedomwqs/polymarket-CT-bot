export interface TradeData {
    blockNumber: number;
    transactionHash: string;
    tokenId: string;
    side: number;
    makerAmount: number;
    takerAmount: number;
    maker: string; // The trader's wallet address
    price?: number; // Execution price
}

export interface TradeParams {
    targetWallets: string[];
    copyRatio: number;
    retryLimit: number;
    orderIncrement: number;
    orderTimeout: number;
}
