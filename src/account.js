const { Account, PublicKey } = require('@solana/web3.js');
const ssKeystore = require('./keystore');


const account = {}

account.isAddress = (address) => {
  try {
    const publicKey = new PublicKey(address);
    if (!publicKey) throw new Error('Invalid public key');
    return true;
  } catch (er) {
    return false;
  }
}

account.createAccount = () => {
  const acc = new Account();
  return acc;
}

account.createStrictAccount = (programId) => {
  const createStrictAccountCallback = (_programId, cb) => {
    const acc = new Account();
    const seeds = [acc.publicKey.toBuffer()];
    return PublicKey.createProgramAddress(seeds, _programId).then(re => {
      return cb(acc);
    }).catch(er => {
      return createStrictAccountCallback(_programId, cb);
    });
  }
  return new Promise((resolve, reject) => {
    return createStrictAccountCallback(programId, acc => {
      return resolve(acc);
    });
  });
}

account.createPrefixedAccount = (prefix, debug = false) => {
  if (!prefix || typeof prefix !== 'string') return new Account();
  let counter = 0;
  while (true) {
    const newAccount = new Account();
    const newAddress = newAccount.publicKey.toBase58();
    const newPrefix = newAddress.substring(0, prefix.length);
    if (debug) console.log(counter++);
    if (newPrefix === prefix) return newAccount;
  }
}

account.fromAddress = (address) => {
  if (!address) return false;
  try {
    const publicKey = new PublicKey(address);
    return publicKey;
  } catch (er) {
    return null;
  }
}

account.fromSecretKey = (secretKey) => {
  if (!secretKey) return null;
  try {
    return new Account(Buffer.from(secretKey, 'hex'));
  } catch (er) {
    return null;
  }
}

account.fromKeystore = (keystore, password) => {
  if (!keystore || !password) return null;
  const secretKey = ssKeystore.decrypt(keystore, password);
  if (!secretKey) return null;
  return account.fromSecretKey(secretKey);
}

module.exports = account;