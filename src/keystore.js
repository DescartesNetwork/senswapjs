const pbkdf2 = require('pbkdf2');
const aesjs = require('aes-js');
const cryptoRandomString = require('crypto-random-string');
const { Account } = require('@solana/web3.js');


const keystore = {}

keystore.hollowKeystore = () => {
  return {
    publicKey: '',
    Crypto: {
      ciphertext: '',
      cipherparams: { counter: Math.floor(100000 + Math.random() * 900000) },
      kdfparams: { c: 8192, dklen: 32, prf: 'sha512', salt: cryptoRandomString({ length: 64 }) }
    }
  }
}

keystore.decrypt = (ks, pwd) => {
  if (!ks || !pwd) return null;
  try {
    const {
      publicKey,
      Crypto: {
        ciphertext,
        cipherparams: { counter },
        kdfparams: { c, dklen, prf, salt }
      }
    } = ks;
    const key = pbkdf2.pbkdf2Sync(pwd, salt, c, dklen, prf);
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(counter));
    const secretKey = aesCtr.decrypt(aesjs.utils.hex.toBytes(ciphertext));
    const account = new Account(secretKey);
    if (account.publicKey.toBase58() !== publicKey) return null;
    return Buffer.from(account.secretKey).toString('hex');
  } catch (er) {
    return null;
  }
}

keystore.encrypt = (secretKey, pwd) => {
  if (!secretKey || !pwd) return null;
  try {
    let ks = keystore.hollowKeystore();
    const {
      Crypto: {
        cipherparams: { counter },
        kdfparams: { c, dklen, prf, salt }
      }
    } = ks;
    const account = new Account(Buffer.from(secretKey, 'hex'));
    const key = pbkdf2.pbkdf2Sync(pwd, salt, c, dklen, prf);
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(counter));
    const cipherbuf = aesCtr.encrypt(account.secretKey);
    const ciphertext = aesjs.utils.hex.fromBytes(cipherbuf);
    ks.publicKey = account.publicKey.toBase58();
    ks.Crypto.ciphertext = ciphertext;
    return ks;
  } catch (er) {
    return null;
  }
}

keystore.gen = (pwd) => {
  if (!pwd) return null;
  const account = new Account();
  const secretKey = Buffer.from(account.secretKey).toString('hex');
  return keystore.encrypt(secretKey, pwd);
}

module.exports = keystore;