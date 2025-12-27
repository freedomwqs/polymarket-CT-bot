import { ENV } from './env';

// List of traders to copy
export const TRADER_LIST = [
    ENV.USER_ADDRESS,
    '0x006cc834Cc092684F1B56626E23BEdB3835c16ea', // @0x006cc834Cc092684F1B56626E23BEdB3835c16ea-1729683673397
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
