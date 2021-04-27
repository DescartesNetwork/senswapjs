const axios = require('axios');
const seedrandom = require('seedrandom');
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const emoji = require('../data/emoji.json');

const TOTAL_EMOJI = emoji.length;


const util = {}

util.BASIC_TX_FEE = 0.000005;

util.LAMPORTS_PER_SOL = LAMPORTS_PER_SOL;

util.randEmoji = (seed) => {
  return emoji[Math.floor(seedrandom(seed)() * TOTAL_EMOJI)];
}

util.toSymbol = (symbol) => {
  if (!symbol) return '';
  return symbol.join('').replace(/\u0000/g, '').replace(/-/g, '');
}

util.parseCGK = (ticket = 'solana') => {
  return new Promise((resolve, reject) => {
    return axios({
      method: 'get',
      url: 'https://api.coingecko.com/api/v3/coins/' + ticket,
    }).then(({ data: {
      image: { large, small, thumb },
      symbol: refSymbol,
      name,
      platforms: { solana },
      market_cap_rank: rank,
      market_data: {
        current_price: { usd }
      }
    } }) => {
      const icon = large || thumb || small;
      const symbol = refSymbol.toUpperCase();
      const address = solana;
      return resolve({ icon, symbol, name, address, rank, usd });
    }).catch(er => {
      return reject(er);
    });
  });
}

util.salt = () => {
  return Buffer.from(nacl.randomBytes(64)).toString('hex');
}

module.exports = util;