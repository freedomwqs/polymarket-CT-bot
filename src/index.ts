import readline from 'readline';
import createClobClient from './utils/createClobClient';
import { ClobClient } from '@polymarket/clob-client';
import ora from 'ora';
import TradeMonitor from './services/tradeMonitor';
import tradeExecutor from './services/tradeExecutor';
import { TradeParams } from './interfaces/tradeInterfaces';
import { TRADER_LIST } from './config/traders';
import { startDashboard } from './dashboard/server';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

// Check for dashboard flag
if (process.argv.includes('--dashboard')) {
    startDashboard();
    console.log('Dashboard started. Continuing to bot initialization...');
}

// Force global proxy agent for axios if proxy is set
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
        console.log(`Using Proxy: ${proxyUrl}`);
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        // @ts-ignore
        axios.defaults.httpsAgent = httpsAgent;
        // @ts-ignore
        axios.defaults.proxy = false; // Disable axios default proxy handling to use the agent
    }
}

const promptUser = async (): Promise<TradeParams> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log(
        'hey, I’m going to go into monitor mode for a few days, what parameters should I use the whole time I’m running?'
    );

    const question = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

    // Allow user to input custom wallets or default to the config list
    let targetWalletsInput = await question('Enter target wallet addresses (comma separated) or press Enter to use config list: ');
    let targetWallets: string[] = [];

    if (targetWalletsInput.trim() === '') {
        targetWallets = TRADER_LIST;
        console.log(`Using configured trader list: ${targetWallets.join(', ')}`);
    } else {
        targetWallets = targetWalletsInput.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
    }

    const copyRatioInput = await question('Enter your wanted ratio (fraction, e.g. 0.5) [default: 0.1]: ');
    const copyRatio = copyRatioInput.trim() === '' ? 0.1 : parseFloat(copyRatioInput);

    const retryLimitInput = await question('Enter retry limit [default: 3]: ');
    const retryLimit = retryLimitInput.trim() === '' ? 3 : parseInt(retryLimitInput, 10);

    const orderTimeoutInput = await question('Enter order timeout (in seconds) [default: 30]: ');
    const orderTimeout = orderTimeoutInput.trim() === '' ? 30 : parseInt(orderTimeoutInput, 10);

    const orderIncrementInput = await question('Enter order increment (in cents) [default: 0]: ');
    const orderIncrement = orderIncrementInput.trim() === '' ? 0 : parseFloat(orderIncrementInput);

    rl.close();

    return {
        targetWallets,
        copyRatio,
        retryLimit,
        orderIncrement,
        orderTimeout,
    };
};

export const main = async () => {
    // Skip DB connection for local run simplification
    // const connectDBSpinner = ora('Connecting DB...').start();
    // await connectDB();
    // connectDBSpinner.succeed('Connected to MongoDB.\n');
    
    const createClobClientSpinner = ora('Creating ClobClient...').start();
    console.log("VERSION 2.0 - NEW TRADE MONITOR");
    try {
        const clobClient = await createClobClient();
        createClobClientSpinner.succeed('ClobClient created\n');
        
        // Use defaults for PM2/Production environment
    const params = {
        targetWallets: TRADER_LIST,
        copyRatio: 1.0,
        retryLimit: 3,
        orderIncrement: 0,
        orderTimeout: 30
    };
        console.log(`Using default parameters: ${JSON.stringify(params)}`);

        const monitor = new TradeMonitor();
        monitor.on('transaction', (data) => {
            tradeExecutor(clobClient, data, params);
        });
        
        // Start monitoring all target wallets
        monitor.start(params.targetWallets);
    } catch (error) {
        createClobClientSpinner.fail('Failed to initialize ClobClient');
        console.error(error);
        process.exit(1);
    }
};

// Check if dashboard mode is enabled, if so, do not run main bot logic automatically unless requested
if (process.argv.includes('--dashboard')) {
    console.log('Running in Dashboard Mode only.');
} else {
    main();
}
