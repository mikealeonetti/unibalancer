import { ethers } from 'ethers'
import INONFUNGIBLE_POSITION_MANAGER from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { userWallet } from '../network'
import { NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS } from '../constants'

export default  new ethers.Contract(
    NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
    INONFUNGIBLE_POSITION_MANAGER.abi,
    userWallet
);