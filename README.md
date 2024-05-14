# Uniswap v3 (Concentrated Liquidity) Re-balancer ("unibalancer")
This script is a simple Uniswap rebalancing script that I used on Arbitrum. It's simple in the fact that all it does is re-balance when the price goes out of range. It then uses the percent you specified for the new range. For example, if you specify the range of 10%, it will set the range 5% up and down from the current price.
## How it works
It's pretty fully featured but poorly commented. Here's how it works in a nutshell in workflow form. Note that it specifically works with the ETH/USDC pair.

1. If no position is open, open a new position.
  - In order to do this, the amount of ETH and USDC needed for the balance is calculated and swapped.
  - Settings like which fee tier, range percent, and how much ETH to hold back for gas are adjustable.
2. Currently open position is tracked and logged.
  - Notifications are sent hourly if Telegram settings are enabled.
3. If profit reaches greater than x% of opening value OR time threshold (both settable) is reached, profit is taken and re-compounded back in.
4. If the position is out of range, a re-balance is triggered.

### Tracking - Profits and Deficits
All trades, profits, and deficits are logged to an SQLite3 database. Gas charges and swap fees are considered deficits. Amount of fees earned are considered profits. Although, profits are really how much you've earned in total.

There is an option to set aside some of the earned fees to accumulate them.

## Some things to note
- I had a really hard time with Uniswap's own smart router SDK, so I stole from their code instead.
- Arbitrum gas sometimes spikes during times of high activity.
- This is for educational purposes. I am not suggesting you'll become rich off of this. NFA. DYOR.
- If you find I accidentally put my private key in the code, please don't steal all my ETH.

## .env config
Here is a sample .env config. You'll need one to run this.

```dotenv
# Whether or not we're running in production mode. This will switch beteen the differnt RPCs when you toggle this.
IS_PRODUCTION=false

# Debug RPCs (used with Anvil)
DEBUG_NETWORK_PROVIDER=http://127.0.0.1:8545
DEBUG_NETWORK_CHAINID=42161

# Productino RPCs
PRODUCTION_NETWORK_PROVIDER=https://arb-pokt.nodies.app
PRODUCTION_NETWORK_CHAINID=42161

# Your private and public keys
PRIVATE_KEY=...
PUBLIC_KEY=...

# The winston log level
LOG_LEVEL=debug

# How long after the price goes out of range to wait to re-balance.
# When this is zero, it will listen for swap events. When a swap event
# happens knocking you out of range, it will re-balance immediately.
# When it's greater than zero, it does NOT listen for swap
# events.
TOLERANCE_IN_MINUTES=0

# The slippage amounts in percent out of 100.
SWAP_SLIPPAGE=3
DEPOSIT_SLIPPAGE=1
WITHDRAW_SLIPPAGE=3

# The desired range percent for price.
RANGE_PERCENT=5

# How much of the fees you want to set aside. The rest
# is re-compounded in. Make this 0 to re-compound in everything.
TAKE_PROFIT_PERCENT=50

# How much gas we want to hold back
MAXIMUM_GAS_TO_SAVE=0.005

# How low our gas will get before we trigger a sell of WETH to get more gas to get gas to save
MINIMUM_GAS_TO_SAVE=0.0025

# Not used. A holdover from the Solana Orca re-balancer.
MINIMUM_AMOUNT_TO_DEPOSIT_DOLLARS=5

# Whether or not to redo debug mode
IS_DEBUG_MODE=true

# Put a telegram API key for a bot in here and subscribe to it to enable this.
TELEGRAM_BOT_TOKEN=...

# Re-compound every hours. 0 to disable. "Rebalance" here is a misnomer.
REBALANCE_PER_HOUR_COUNT=0
# Re-compound every time profit reaches percent (out of 100). 0 to disable. "Rebalance" here is a misnomer.
REBALANCE_AT_PERCENT=1

# Do not collect and re-compound when the gas to do so is above this. You can set to a more sane value.
# This will just simply wait to re-compound when the gas is below this value.
REFUSE_COLLECTION_GAS_ABOVE=0.1
# Do not collect fees and re-compound when the price is this close in percent (out of 100) 
# to the upper or lower range.
REFUSE_COLLECTION_TOO_CLOSE_PERCENT=0.5

# How many millis to poll for a txn to have been executed.
TXN_RECEIPT_CHECK_DELAY_MS=1000
```

## Did I make money off of this?
Negative.

It turns out that every time I re-balance down and then back up, total liquidity is lost. So, although, at times the bot would earn 1% a day in fees, it was not enough to stave off the liquidity loss. There is math somewhere behind it.

I suspect you'll need a better strategy. This code will sell off the poorly performing asset to re-balance. It is not optimal.

I learned a lot, though.