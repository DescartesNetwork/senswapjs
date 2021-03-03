const axios = require('axios');
const seedrandom = require('seedrandom');
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
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

util.imgFromCGK = (cgk) => {
  return new Promise((resolve, reject) => {
    return axios({
      method: 'get',
      url: cgk,
    }).then(({ data: { image: { large, small, thumb } } }) => {
      if (large) return resolve(large);
      else if (thumb) return resolve(thumb);
      else if (small) return resolve(small);
      else return reject('No logo');
    }).catch(er => {
      return reject(er);
    });
  });
}

util.symbolFromCGK = (cgk)=>{
  return new Promise((resolve, reject) => {
    return axios({
      method: 'get',
      url: cgk,
    }).then(({ data: { symbol } }) => {
      if (symbol) return resolve(symbol.toUpperCase());
      else return reject('UNKOWN');
    }).catch(er => {
      return reject(er);
    });
  });
}

module.exports = util;