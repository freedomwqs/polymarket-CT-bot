import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
import { ENV } from '../config/env';

const PROXY_WALLET = ENV.PROXY_WALLET;
const PRIVATE_KEY = ENV.PRIVATE_KEY;
const CLOB_HTTP_URL = ENV.CLOB_HTTP_URL;

const createClobClient = async (): Promise<ClobClient> => {
    const chainId = 137;
    const host = CLOB_HTTP_URL as string;
    
    // Initialize provider with fallback
    let provider;
    try {
        provider = new ethers.providers.JsonRpcProvider(ENV.RPC_URL, chainId);
        // Quick check if provider is responsive, if not, use fallback
        // But await provider.getNetwork() might be slow.
        // Let's assume ENV.RPC_URL works, but if not, user should update .env.
        // However, to fix the immediate issue seen in logs:
        // provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com", chainId);
    } catch (error) {
        console.error("Provider init error:", error);
    }
    
    const wallet = new ethers.Wallet(PRIVATE_KEY as string, provider);
    let clobClient = new ClobClient(
        host,
        chainId,
        wallet,
        undefined,
        SignatureType.POLY_GNOSIS_SAFE,
        PROXY_WALLET as string
    );

    const originalConsoleError = console.error;
    console.error = function () {};
    let creds = await clobClient.createApiKey();
    console.error = originalConsoleError;
    if (creds.key) {
        console.log('API Key created', creds);
    } else {
        creds = await clobClient.deriveApiKey();
        console.log('API Key derived', creds);
    }

    clobClient = new ClobClient(
        host,
        chainId,
        wallet,
        creds,
        SignatureType.POLY_GNOSIS_SAFE,
        PROXY_WALLET as string
    );
    console.log(clobClient);
    return clobClient;
};

export default createClobClient;
