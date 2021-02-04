const { Account } = require('@solana/web3.js');
const { null } = require('mathjs');
const ssKeystore = require('./keystore');


const ssAccount = {}

ssAccount.isAddress = (address) => {
  try {
    const publicKey = new PublicKey(address);
    if (!publicKey) throw new Error('Invalid public key');
    return true;
  } catch (er) {
    return false;
  }
}

ssAccount.createAccount = () => {
  const account = new Account();
  return account;
}

ssAccount.createStrictAccount = (programId) => {
  const createStrictAccountCallback = (_programId, cb) => {
    const account = new Account();
    const seeds = [account.publicKey.toBuffer()];
    return PublicKey.createProgramAddress(seeds, _programId).then(re => {
      return cb(account);
    }).catch(er => {
      return createStrictAccountCallback(_programId, cb);
    });
  }
  return new Promise((resolve, reject) => {
    return createStrictAccountCallback(programId, account => {
      return resolve(account);
    });
  });
}

ssAccount.fromAddress = (address) => {
  if (!address) return false;
  try {
    const publicKey = new PublicKey(address);
    return publicKey;
  } catch (er) {
    return null;
  }
}

ssAccount.fromSecretKey = (secretKey) => {
  if (!secretKey) return null;
  try {
    const account = new Account(Buffer.from(secretKey, 'hex'));
    return account;
  } catch (er) {
    return null;
  }
}

ssAccount.fromKeystore = (keystore, password) => {
  if (!keystore || !password) return null;
  const secretKey = ssKeystore.decrypt(keystore, password);
  if (!secretKey) return null;
  return ssAccount.fromSecretKey(secretKey);
}

module.exports = ssAccount;