import { ClobClient, Side } from '@polymarket/clob-client';
import { TradeData, TradeParams } from '../interfaces/tradeInterfaces';
import getMyBalance from '../utils/getMyBalance';
import { ENV } from '../config/env';
import OrderManager from './orderManager';

const tradeExecutor = async (
    clobClient: ClobClient,
    tradeData: TradeData,
    params: TradeParams
) => {
    if (ENV.PAUSE_TRADING) {
        console.log('Trading is paused by configuration. Skipping execution.');
        return;
    }

    const orderManager = OrderManager.getInstance();

    // Check for expired orders every time we try to execute
    await orderManager.checkAndCancelExpiredOrders(clobClient);

    console.log(`Executing copy trade for tx: ${tradeData.transactionHash}`);
    console.log(`TokenID: ${tradeData.tokenId}, Side: ${tradeData.side === 0 ? 'BUY' : 'SELL'}, Original Amount: ${tradeData.takerAmount}`);

    try {
        // 1. Determine side
        const side = tradeData.side === 0 ? Side.BUY : Side.SELL;

        // 2. Determine Price (Use Trader's Execution Price)
        let price = tradeData.price || 0;
        
        if (price <= 0) {
            console.warn(`Invalid price in tradeData (${price}). Attempting to fetch from orderbook as fallback...`);
            // Fallback to orderbook (Best Ask/Bid) if price is missing
            try {
                const orderbook = await clobClient.getOrderBook(tradeData.tokenId);
                if (side === Side.BUY) {
                    if (orderbook.asks && orderbook.asks.length > 0) price = parseFloat(orderbook.asks[0].price);
                } else {
                    if (orderbook.bids && orderbook.bids.length > 0) price = parseFloat(orderbook.bids[0].price);
                }
            } catch (err) {
                console.error('Failed to fetch orderbook for fallback price:', err);
                return;
            }
        }
        
        console.log(`Target Price (Maker Mode): ${price}`);

        // 3. Calculate order size (Token Amount)
        // New Logic: OurStake = (OurBank / TraderBank) * TraderStake
        // TraderStake = tradeData.takerAmount (USDC)
        
        let usdcAmount = 0;
        let dynamicCopyRatio = params.copyRatio; // Default fallback
        let currentMyBalance = -1; // Cache for our balance

        try {
            if (!tradeData.maker) {
                console.warn('Trader address missing in tradeData, falling back to fixed copyRatio.');
            } else {
                // Fetch Trader's Balance (Remaining USDC after trade)
                const traderCurrentBalance = await getMyBalance(tradeData.maker);
                
                // TraderBank calculation
                let traderBank = traderCurrentBalance;
                if (side === Side.BUY) {
                    traderBank += tradeData.takerAmount;
                } else {
                    traderBank -= tradeData.takerAmount;
                    if (traderBank < 0) traderBank = 0; 
                }

                // Fetch Our Balance
                currentMyBalance = await getMyBalance(ENV.PROXY_WALLET);
                const myBank = currentMyBalance;

                console.log(`Balances - Trader: ${traderBank} (approx), Us: ${myBank}`);

                if (traderBank > 0) {
                    dynamicCopyRatio = myBank / traderBank;
                    console.log(`Calculated Dynamic Copy Ratio: ${dynamicCopyRatio.toFixed(4)}`);
                } else {
                    console.warn('Trader bank is 0 or negative, cannot calculate ratio. Falling back to fixed params.');
                }
            }
        } catch (err) {
            console.error('Error fetching balances for ratio calculation:', err);
        }

        // Apply Ratio
        usdcAmount = tradeData.takerAmount * dynamicCopyRatio;
        
        // Ensure positive
        if (usdcAmount <= 0) {
            console.log('Calculated USDC amount is 0 or negative, skipping.');
            return;
        }

        // Check Balance and Free Up Funds if needed
        if (side === Side.BUY) {
            try {
                let balance = currentMyBalance;
                // If we didn't fetch it successfully above (e.g. error or maker missing), fetch now
                if (balance < 0) {
                     balance = await getMyBalance(ENV.PROXY_WALLET);
                }

                console.log(`Current Proxy USDC Balance: ${balance}`);
                
                // Fund Recycling Logic
                if (usdcAmount > balance) {
                    const shortage = usdcAmount - balance;
                    console.log(`Insufficient balance (Shortage: ${shortage}). Attempting to free up funds from old orders...`);
                    
                    await orderManager.freeUpFunds(clobClient, shortage);
                    
                    // Re-fetch balance after cancellation
                    // Add a small delay to ensure balance update propagates if needed, though usually CLOB updates are quick
                    await new Promise(r => setTimeout(r, 1000));
                    balance = await getMyBalance(ENV.PROXY_WALLET);
                    console.log(`New Proxy USDC Balance: ${balance}`);
                }

                if (usdcAmount > balance) {
                    console.warn(`Calculated USDC amount ($${usdcAmount}) still exceeds balance ($${balance}). Adjusting to balance.`);
                    // Use 99% of balance to be safe
                    usdcAmount = balance * 0.99; 
                }
                
                if (usdcAmount < 1) { // Polymarket min order is $1
                     console.warn(`Available USDC amount ($${usdcAmount}) is below minimum $1.`);
                     if (balance < 1) {
                        console.warn('Insufficient balance (<$1) to place order.');
                        return;
                     }
                }
            } catch (err) {
                console.error('Failed to fetch balance or free funds, proceeding with calculated amount:', err);
            }
        }

        let size = usdcAmount / price;

        // Enforce minimum order value of 1 USDC (Polymarket requirement)
        if (size * price < 1) {
            console.log(`Calculated value ($${size * price}) is below minimum $1. Adjusting to $1.01.`);
            // Set size to be equivalent to $1.01 to be safe
            size = 1.01 / price;
        }

        // Round size to appropriate precision (e.g. 6 decimal places)
        size = parseFloat(size.toFixed(6));
        
        // Re-check value after rounding
        if (size * price < 1) {
             size = parseFloat((1.01 / price).toFixed(6));
        }

        // 4. Place Order
        console.log(`Placing LIMIT order (MAKER): Side: ${side}, Size: ${size}, Price: ${price}, TokenID: ${tradeData.tokenId}`);

        // Create and Post Order
        const order = await clobClient.createOrder({
            tokenID: tradeData.tokenId,
            price: price,
            side: side,
            size: size,
            feeRateBps: 0, 
            nonce: 0 
        });
        
        const response = await clobClient.postOrder(order);
        console.log('Order executed successfully:', response);
        
        // Track the order for management
        if (response && response.orderID) {
            orderManager.addOrder(response.orderID, price, size, tradeData.tokenId);
        }

    } catch (error) {
        console.error('Error executing trade:', error);
        // Implement retry logic based on params.retryLimit here if needed
    }
};

export default tradeExecutor;
