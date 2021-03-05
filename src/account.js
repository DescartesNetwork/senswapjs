const { Account, PublicKey } = require('@solana/web3.js');
const { doUntil } = require('async');
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

account.createPrefixedAccount = (prefix, callback = () => { }) => {
  return new Promise((resolve, reject) => {
    return doUntil((cb) => {
      return setTimeout(() => {
        const acc = new Account();
        return cb(null, acc);
      }, 0);
    }, (acc, cb) => {
      if (!prefix || typeof prefix !== 'string') return cb(null, true);
      const addr = acc.publicKey.toBase58();
      callback(addr);
      const pref = addr.substring(0, prefix.length);
      return cb(null, pref === prefix);
    }, (er, acc) => {
      if (er) return reject(er);
      return resolve(acc);
    });
  });
}

account.deriveAssociatedAddress = (
  walletAddress,
  mintAddress,
  spltPromgramAddress,
  splataProgramAddress
) => {
  return new Promise((resolve, reject) => {
    if (!account.isAddress(walletAddress)) return reject('Invalid wallet address');
    if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
    if (!account.isAddress(spltPromgramAddress)) return reject('Invalid SPL token address');
    if (!account.isAddress(splataProgramAddress)) return reject('Invalid SPL associated token account address');
    const walletPublicKey = account.fromAddress(walletAddress);
    const mintPublicKey = account.fromAddress(mintAddress);
    const spltPublicKey = account.fromAddress(spltPromgramAddress);
    const splataPublicKey = account.fromAddress(splataProgramAddress);

    return PublicKey.findProgramAddress(
      [
        walletPublicKey.toBuffer(),
        spltPublicKey.toBuffer(),
        mintPublicKey.toBuffer(),
      ],
      splataPublicKey
    ).then(([publicKey, _]) => {
      return resolve(publicKey.toBase58());
    }).catch(er => {
      return reject(er);
    });
  });
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