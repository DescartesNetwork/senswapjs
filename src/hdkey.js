const pbkdf2 = require('pbkdf2');
const bs58 = require('bs58');
const BN = require('bn.js');
const account = require('./account');


class HDKey {
  constructor() {
    this.encode = {
      bufLen: 32,
      endian: 'le'
    }
    this.kdf = {
      c: 4096, // Refer WPA2
      dklen: 64,
      prf: 'sha512'
    }
  }

  _parsePath = (path) => {
    const arr = path.split('/');
    if (!arr[arr.length - 1]) arr.pop();
    const prefix = arr.shift();
    if (prefix !== 'm') throw new Error('Invalid prefix');
    const invalid = arr.some(pathAddress => !account.isAddress(pathAddress));
    if (invalid) throw new Error('Invalid path address');
    return arr;
  }

  toPathAddress = (strInt) => {
    const index = new BN(strInt);
    const { bufLen, endian } = this.encode;
    const buf = Buffer.from(index.toArray(endian, bufLen));
    const addr = bs58.encode(buf);
    return addr;
  }

  fromPathAddress = (pathAddress) => {
    if (!account.isAddress(pathAddress)) throw new Error('Invalid path address');
    const buf = account.fromAddress(pathAddress).toBuffer();
    const { bufLen, endian } = this.encode;
    const bigInt = new BN(buf, bufLen, endian);
    return bigInt.toString();
  }

  _deriveChildKey = (parentKey, pathAddress) => {
    const buf = account.fromAddress(pathAddress).toBuffer();
    const seed = buf.toString('hex');
    const { c, dklen, prf } = this.kdf;
    const childKey = pbkdf2.pbkdf2Sync(parentKey, seed, c, dklen, prf);
    return childKey;
  }

  deriveChildKey = (parentKey, path) => {
    let key = parentKey;
    for (let pathAddress of this._parsePath(path)) {
      key = this._deriveChildKey(key, pathAddress);
    }
    return key;
  }

  deriveChild = (parentKey, path) => {
    const childKey = this.deriveChildKey(parentKey, path);
    const acc = account.fromSecretKey(childKey);
    return acc;
  }
}

module.exports = HDKey;