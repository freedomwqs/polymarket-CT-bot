export interface TradeData {
    blockNumber: number;
    transactionHash: string;
    tokenId: string;
    side: number;
    makerAmount: number;
    takerAmount: number;
}

export interface TradeParams {
    targetWallets: string[];
    copyRatio: number;
    retryLimit: number;
    orderIncrement: number;
    orderTimeout: number;
}
