const keccak256 = require('keccak256');
const aesjs = require('aes-js');
const { PublicKey } = require('@solana/web3.js');
const xor = require('buffer-xor');

const { fromAddress } = require('./account');

const crypto = {}

crypto.hash = (str) => {
  if (!str) return null;
  return keccak256(str).toString('hex');
}

crypto.encrypt = (key, plain) => {
  if (!key || !plain) return null;
  const k = Buffer.from(key, 'hex');
  const p = aesjs.utils.utf8.toBytes(plain);
  const aesCtr = new aesjs.ModeOfOperation.ctr(k, new aesjs.Counter(5));
  const c = aesCtr.encrypt(p);
  return aesjs.utils.hex.fromBytes(c);
}

crypto.decrypt = (key, cypher) => {
  if (!key || !cypher) return null;
  const k = Buffer.from(key, 'hex');
  const c = aesjs.utils.hex.toBytes(cypher);
  const aesCtr = new aesjs.ModeOfOperation.ctr(k, new aesjs.Counter(5));
  const p = aesCtr.decrypt(c);
  return aesjs.utils.utf8.fromBytes(p);
}

crypto.proofOfMintLPT = (poolAddress, swapProgramAddress) => {
  return new Promise((resolve, reject) => {
    const poolPublicKey = fromAddress(poolAddress);
    const swapProgramId = fromAddress(swapProgramAddress);
    const seed = [poolPublicKey.toBuffer()];
    return PublicKey.createProgramAddress(seed, swapProgramId).then(treasurerPublicKey => {
      const a = poolPublicKey.toBuffer();
      const b = treasurerPublicKey.toBuffer();
      const c = xor(a, b);
      const proof = new PublicKey(c);
      return resolve(proof.toBase58());
    }).catch(er => {
      return reject(er);
    });
  });
}

module.exports = crypto;