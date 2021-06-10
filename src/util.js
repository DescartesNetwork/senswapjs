const axios = require('axios');
const seedrandom = require('seedrandom');
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const emoji = require('../data/emoji.json');


const util = {}

util.BASIC_TX_FEE = 0.000005;
util.TOTAL_EMOJI = emoji.length;
util.LAMPORTS_PER_SOL = LAMPORTS_PER_SOL;

util.randEmoji = (seed) => {
  return emoji[Math.floor(seedrandom(seed)() * util.TOTAL_EMOJI)];
}

util.parseCGK = async (ticket = '') => {
  const { data: {
    image: { large, small, thumb },
    symbol: refSymbol,
    name,
    platforms: { solana },
    market_cap_rank: rank,
    market_data: {
      current_price: { usd: price },
      total_volume: { usd: totalVolume },
      price_change_percentage_24h: priceChange,
    },
  } } = await axios({
    method: 'get',
    url: 'https://api.coingecko.com/api/v3/coins/' + ticket,
  });
  const icon = large || thumb || small;
  const symbol = refSymbol.toUpperCase();
  const address = solana;
  return {
    icon, symbol, name, address,
    rank, price, priceChange, totalVolume
  }
}

module.exports = util;