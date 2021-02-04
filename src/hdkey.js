const pbkdf2 = require('pbkdf2');
const bs58 = require('bs58');
const BN = require('bn.js');
const account = require('./account');


class HDKey {
  constructor() {
    this.bufLen = 32;
    this.c = 4096 // Refer WPA2
    this.dklen = 64;
    this.prf = 'sha512';
    this.endian = 'le';
  }

  _parsePath = (path) => {
    const arr = path.split('/');
    const prefix = arr.shift();
    if (prefix !== 'm') throw new Error('Invalid prefix');
    const invalid = arr.some(pathAddress => !account.isAddress(pathAddress));
    if (invalid) throw new Error('Invalid path address');
    return arr;
  }

  toPathAddress = (strInt) => {
    const index = new BN(strInt);
    const buf = Buffer.from(index.toArray(this.endian, this.bufLen));
    const addr = bs58.encode(buf);
    return addr;
  }

  fromPathAddress = (pathAddress) => {
    if (!account.isAddress(pathAddress)) throw new Error('Invalid path address');
    const buf = account.fromAddress(pathAddress).toBuffer();
    const bigInt = new BN(buf, this.bufLen, this.endian);
    return bigInt.toString();
  }

  _deriveChildKey = (parentKey, pathAddress) => {
    const buf = account.fromAddress(pathAddress).toBuffer();
    const seed = buf.toString('hex');
    const childKey = pbkdf2.pbkdf2Sync(parentKey, seed, this.c, this.dklen, this.prf);
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