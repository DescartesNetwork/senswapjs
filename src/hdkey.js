const nacl = require('tweetnacl');
const pbkdf2 = require('pbkdf2');
const bs58 = require('bs58');
const xor = require('buffer-xor');
const BN = require('bn.js');

const account = require('./account');


const hdkey = {}

hdkey.ENCODE_PARAMS = {
  bufLen: 32,
  endian: 'le'
}

hdkey.KDF_PARAMS = {
  c: 4096, // Refer WPA2
  dklen: 64,
  prf: 'sha512'
}

hdkey._parsePath = (path) => {
  const arr = path.split('/');
  if (!arr[arr.length - 1]) arr.pop();
  const prefix = arr.shift();
  if (prefix !== 'm') throw new Error('Invalid prefix');
  const invalid = arr.some(pathAddress => !account.isAddress(pathAddress));
  if (invalid) throw new Error('Invalid path address');
  return arr;
}

hdkey._deriveChildKey = (parentKey, pathAddress) => {
  const buf = account.fromAddress(pathAddress).toBuffer();
  const seed = buf.toString('hex');
  const { c, dklen, prf } = hdkey.KDF_PARAMS;
  const seedBuf = pbkdf2.pbkdf2Sync(parentKey, seed, c, dklen, prf);
  const firstHalfBuf = seedBuf.slice(0, seedBuf.length / 2);
  const secondHalfBuf = seedBuf.slice(seedBuf.length / 2, seedBuf.length);
  const xoredBuf = xor(firstHalfBuf, secondHalfBuf);
  const childKeyPair = nacl.sign.keyPair.fromSeed(xoredBuf);
  return childKeyPair.secretKey;
}

hdkey.toPathAddress = (strInt) => {
  const index = new BN(strInt);
  const { bufLen, endian } = hdkey.ENCODE_PARAMS;
  const buf = Buffer.from(index.toArray(endian, bufLen));
  const addr = bs58.encode(buf);
  return addr;
}

hdkey.fromPathAddress = (pathAddress) => {
  if (!account.isAddress(pathAddress)) throw new Error('Invalid path address');
  const buf = account.fromAddress(pathAddress).toBuffer();
  const { bufLen, endian } = hdkey.ENCODE_PARAMS;
  const bigInt = new BN(buf, bufLen, endian);
  return bigInt.toString();
}

hdkey.deriveChildKey = (parentKey, path) => {
  let key = parentKey;
  for (let pathAddress of hdkey._parsePath(path)) {
    key = hdkey._deriveChildKey(key, pathAddress);
  }
  return key;
}

hdkey.deriveChild = (parentKey, path) => {
  const childKey = hdkey.deriveChildKey(parentKey, path);
  const acc = account.fromSecretKey(childKey);
  return acc;
}

module.exports = hdkey;