import { JsonRpcProvider, Wallet } from 'ethers';
import { NETWORK_CHAIN_ID, NETWORK_PROVIDER, PRIVATE_KEY } from './constants';

export const provider = new JsonRpcProvider(NETWORK_PROVIDER, {
    name: "Arbitrum One",
    chainId: NETWORK_CHAIN_ID
},
    {
        staticNetwork: true
    });

export const userWallet = new Wallet(PRIVATE_KEY, provider);