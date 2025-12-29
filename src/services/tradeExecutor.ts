import { ClobClient, Side } from '@polymarket/clob-client';
import { TradeData, TradeParams } from '../interfaces/tradeInterfaces';
import getMyBalance from '../utils/getMyBalance';
import { ENV } from '../config/env';

const tradeExecutor = async (
    clobClient: ClobClient,
    tradeData: TradeData,
    params: TradeParams
) => {
    console.log(`Executing copy trade for tx: ${tradeData.transactionHash}`);
    console.log(`TokenID: ${tradeData.tokenId}, Side: ${tradeData.side === 0 ? 'BUY' : 'SELL'}, Original Amount: ${tradeData.takerAmount}`);

    try {
        // 1. Determine side
        const side = tradeData.side === 0 ? Side.BUY : Side.SELL;

        // 2. Fetch Market Price (Best Ask for Buy, Best Bid for Sell)
        // We need the orderbook to price our limit order effectively (simulate market order)
        let price = 0;
        
        try {
            const orderbook = await clobClient.getOrderBook(tradeData.tokenId);
            
            if (side === Side.BUY) {
                // Buying: Match the lowest seller (Asks are sorted ascending price usually)
                if (orderbook.asks && orderbook.asks.length > 0) {
                    price = parseFloat(orderbook.asks[0].price);
                    console.log(`Best Ask Price: ${price}`);
                    if (price >= 1) {
                        console.warn('Price >= 1 detected for BUY. Skipping order to avoid zero-profit bet.');
                        return;
                    }
                } else {
                    console.warn('No asks found in orderbook. Cannot determine price for BUY.');
                    return;
                }
            } else {
                // Selling: Match the highest buyer (Bids are sorted descending price usually)
                if (orderbook.bids && orderbook.bids.length > 0) {
                    price = parseFloat(orderbook.bids[0].price);
                    console.log(`Best Bid Price: ${price}`);
                } else {
                    console.warn('No bids found in orderbook. Cannot determine price for SELL.');
                    return;
                }
            }
        } catch (err) {
            console.error('Failed to fetch orderbook:', err);
            return;
        }

        // 3. Calculate order size (Token Amount)
        // tradeData.takerAmount is in USDC
        // We want to spend: tradeData.takerAmount * params.copyRatio (USDC)
        // Token Size = USDC Amount / Price
        let usdcAmount = tradeData.takerAmount * params.copyRatio;
        
        // Ensure positive
        if (usdcAmount <= 0) {
            console.log('Calculated USDC amount is 0 or negative, skipping.');
            return;
        }

        // Check Balance if Buying to avoid "not enough balance" errors
        if (side === Side.BUY) {
            try {
                const balance = await getMyBalance(ENV.PROXY_WALLET);
                console.log(`Current Proxy USDC Balance: ${balance}`);
                
                if (usdcAmount > balance) {
                    console.warn(`Calculated USDC amount ($${usdcAmount}) exceeds balance ($${balance}). Adjusting to balance.`);
                    // Use 99% of balance to be safe against rounding or small fees if any, though fees are usually 0 for makers
                    usdcAmount = balance * 0.99; 
                }
                
                if (usdcAmount < 1) { // Polymarket min order is $1
                     console.warn(`Available USDC amount ($${usdcAmount}) is below minimum $1.`);
                     // Try to use full balance if it's slightly above 1 but logic reduced it? 
                     // No, if balance is < 1, we can't trade.
                     if (balance < 1) {
                        console.warn('Insufficient balance (<$1) to place order.');
                        return;
                     }
                }
            } catch (err) {
                console.error('Failed to fetch balance, proceeding with calculated amount:', err);
            }
        }

        let size = usdcAmount / price;

        // Enforce minimum order value of 1 USDC (Polymarket requirement)
        if (size * price < 1) {
            console.log(`Calculated value ($${size * price}) is below minimum $1. Adjusting to $1.01.`);
            // Set size to be equivalent to $1.01 to be safe
            size = 1.01 / price;
        }

        // Round size to appropriate precision (e.g. 2 decimal places? or more?)
        // Polymarket tokens usually support standard ERC20 precision, but CLOB might limit it.
        // Let's keep a reasonable precision, e.g., 6 decimal places
        size = parseFloat(size.toFixed(6));
        
        // Re-check value after rounding
        if (size * price < 1) {
             size = parseFloat((1.01 / price).toFixed(6));
        }

        // 4. Place Order
        console.log(`Placing LIMIT order: Side: ${side}, Size: ${size}, Price: ${price}, TokenID: ${tradeData.tokenId}`);

        // Create and Post Order
        // Note: clob-client handles signing automatically if initialized with credentials
        const order = await clobClient.createOrder({
            tokenID: tradeData.tokenId,
            price: price,
            side: side,
            size: size,
            feeRateBps: 0, // Maker orders usually 0, Taker might have fee but we specify 0 in order param usually? 
                           // Actually for Taker (crossing spread) we might need to accept fee?
                           // Using 0 is standard for limit orders, CLOB matches.
            nonce: 0 // Optional, client handles it
        });
        
        const response = await clobClient.postOrder(order);
        console.log('Order executed successfully:', response);

    } catch (error) {
        console.error('Error executing trade:', error);
        // Implement retry logic based on params.retryLimit here if needed
    }
};

export default tradeExecutor;
