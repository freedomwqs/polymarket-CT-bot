import { ClobClient } from '@polymarket/clob-client';

interface ManagedOrder {
    orderId: string;
    timestamp: number;
    price: number;
    size: number;
    tokenId: string;
}

class OrderManager {
    private static instance: OrderManager;
    private orders: ManagedOrder[] = [];
    private readonly ORDER_TIMEOUT = 60 * 60 * 1000; // 1 Hour

    private constructor() {}

    public static getInstance(): OrderManager {
        if (!OrderManager.instance) {
            OrderManager.instance = new OrderManager();
        }
        return OrderManager.instance;
    }

    public addOrder(orderId: string, price: number, size: number, tokenId: string) {
        this.orders.push({
            orderId,
            timestamp: Date.now(),
            price,
            size,
            tokenId
        });
        console.log(`[OrderManager] Added order ${orderId} to tracking. Total tracked: ${this.orders.length}`);
    }

    public async checkAndCancelExpiredOrders(clobClient: ClobClient) {
        const now = Date.now();
        const expiredOrders = this.orders.filter(o => now - o.timestamp > this.ORDER_TIMEOUT);

        if (expiredOrders.length === 0) return;

        console.log(`[OrderManager] Found ${expiredOrders.length} expired orders. Cancelling...`);

        for (const order of expiredOrders) {
            await this.cancelOrder(clobClient, order.orderId);
        }
    }

    public async freeUpFunds(clobClient: ClobClient, requiredAmount: number): Promise<void> {
        console.log(`[OrderManager] Attempting to free up ${requiredAmount} USDC by cancelling old orders...`);
        
        // Sort by oldest first
        this.orders.sort((a, b) => a.timestamp - b.timestamp);

        let freedAmount = 0;
        const ordersToCancel: ManagedOrder[] = [];

        for (const order of this.orders) {
            if (freedAmount >= requiredAmount) break;
            // Approximate freed amount = price * size (USDC value)
            freedAmount += order.price * order.size;
            ordersToCancel.push(order);
        }

        if (ordersToCancel.length > 0) {
            console.log(`[OrderManager] Cancelling ${ordersToCancel.length} orders to free up funds.`);
            for (const order of ordersToCancel) {
                await this.cancelOrder(clobClient, order.orderId);
            }
        } else {
            console.log('[OrderManager] No orders available to cancel.');
        }
    }

    private async cancelOrder(clobClient: ClobClient, orderId: string) {
        try {
            console.log(`[OrderManager] Cancelling order ${orderId}...`);
            await clobClient.cancelOrder({ orderID: orderId });
            // Remove from list
            this.orders = this.orders.filter(o => o.orderId !== orderId);
            console.log(`[OrderManager] Order ${orderId} cancelled.`);
        } catch (error) {
            console.error(`[OrderManager] Failed to cancel order ${orderId}:`, error);
            // If error implies order not found (already filled/cancelled), we should still remove it
            // Assuming error message contains something like "Order not found" or 404
            // For now, let's keep it in list if it might be transient error, or remove if it's permanent?
            // To be safe and avoid stuck loop, we might want to remove it if it's "not found".
            // But without checking error code, let's just leave it for next prune cycle or explicit removal logic.
            // Actually, if we fail to cancel, we can't count it as freed.
        }
    }
}

export default OrderManager;
