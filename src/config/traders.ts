import { ENV } from './env';

// List of traders to copy
export const TRADER_LIST = [
    ENV.USER_ADDRESS,
    '0x1f0a343513aa6060488fabe96960e6d1e177f7aa', // Updated by user request
    // Note: The following are placeholders as we only have usernames for some. 
    // You must replace these with the actual Polygon wallet addresses for the bot to work.
    // Polymarket profiles usually show the address or it can be found in the URL if it's an address-based profile.
    // For named profiles (e.g. @RN1), you need to resolve their address manually or via API if available.
    
    // '@RN1', // Resolve to address
    // '@ghostt4', // Resolve to address
    // '@kch123', // Resolve to address
    // '@swisstony', // Resolve to address
    // '@Buccaneers', // Resolve to address
    // '@potko', // Resolve to address
    // '@luckboxx', // Resolve to address
    // '@0p0jogggg', // Resolve to address
    // '@4-seas', // Resolve to address
    // '@Sharpyyy', // Resolve to address
    // '@ckw', // Resolve to address
    // '@primm' // Resolve to address
];

// IMPORTANT: The bot currently only supports monitoring raw wallet addresses. 
// Please look up the 0x addresses for the usernames provided.
