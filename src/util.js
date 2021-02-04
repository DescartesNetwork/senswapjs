const axios = require('axios');
const seedrandom = require('seedrandom');
const emoji = require('./emoji.json');

const TOTAL_EMOJI = emoji.length;


const util = {}

util.BASIC_TX_FEE = 0.000005;

util.randEmoji = (seed) => {
  return emoji[Math.floor(seedrandom(seed)() * TOTAL_EMOJI)];
}

util.imgFromCGK = (cgk) => {
  return new Promise((resolve, reject) => {
    return axios({
      method: 'get',
      url: cgk,
    }).then(({ data: { image: { large } } }) => {
      if (!large) return resolve(null);
      return resolve(large);
    }).catch(er => {
      return resolve(null);
    });
  });
}

module.exports = util;