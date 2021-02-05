const axios = require('axios');
const seedrandom = require('seedrandom');
const emoji = require('./emoji.json');

const TOTAL_EMOJI = emoji.length;


const util = {}

util.BASIC_TX_FEE = 0.000005;

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

module.exports = util;