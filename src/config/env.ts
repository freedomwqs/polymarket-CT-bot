import * as dotenv from 'dotenv';
dotenv.config();

// Fix for proxy self-signed certs and strict SSL issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (!process.env.PUBLIC_ADDRESS) {
    throw new Error('USER_ADDRESS is not defined');
}
if (!process.env.PROXY_WALLET) {
    throw new Error('PROXY_WALLET is not defined');
}
if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not defined');
}
if (!process.env.CLOB_HTTP_URL) {
    throw new Error('CLOB_HTTP_URL is not defined');
}
if (!process.env.CLOB_WS_URL) {
    throw new Error('CLOB_WS_URL is not defined');
}
if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined');
}
if (!process.env.RPC_URL) {
    throw new Error('RPC_URL is not defined');
}
if (!process.env.WSS_URL) {
    throw new Error('WSS_URL is not defined');
}
if (!process.env.USDC_CONTRACT_ADDRESS) {
    throw new Error('USDC_CONTRACT_ADDRESS is not defined');
}
if (!process.env.POLYMARKET_CONTRACT_ADDRESS) {
    throw new Error('POLYMARKET_CONTRACT_ADDRESS is not defined');
}
if (!process.env.USER_ADDRESS) {
    throw new Error('USER_ADDRESS is not defined');
}

export const ENV = {
    PUBLIC_ADDRESS: process.env.PUBLIC_ADDRESS as string,
    PROXY_WALLET: process.env.PROXY_WALLET as string,
    PRIVATE_KEY: process.env.PRIVATE_KEY as string,
    CLOB_HTTP_URL: process.env.CLOB_HTTP_URL as string,
    CLOB_WS_URL: process.env.CLOB_WS_URL as string,
    RPC_URL: process.env.RPC_URL as string,
    WSS_URL: process.env.WSS_URL as string,
    USDC_CONTRACT_ADDRESS: process.env.USDC_CONTRACT_ADDRESS as string,
    POLYMARKET_CONTRACT_ADDRESS: process.env.POLYMARKET_CONTRACT_ADDRESS as string,
    CTF_TOKEN_ADDRESS: process.env.CTF_TOKEN_ADDRESS || '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
    MONGO_URI: process.env.MONGO_URI as string,
    USER_ADDRESS: process.env.USER_ADDRESS as string,
    FETCH_INTERVAL: parseInt(process.env.FETCH_INTERVAL || '1000'),
    TOO_OLD_TIMESTAMP: parseInt(process.env.TOO_OLD_TIMESTAMP || '3600'),
    RETRY_LIMIT: parseInt(process.env.RETRY_LIMIT || '3'),
    PAUSE_TRADING: process.env.PAUSE_TRADING === 'true',
};
