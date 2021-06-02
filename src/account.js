const { Account, PublicKey } = require('@solana/web3.js');
const { doUntil } = require('async');
const nacl = require('tweetnacl');
const ssKeystore = require('./keystore');
const xor = require('buffer-xor');


const account = {}

account.isAddress = (address) => {
  if (!address) return false;
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

account.createPrefixedAccount = (prefix, callback = (a, c) => { }, loose = true) => {
  return new Promise((resolve, reject) => {
    let stop = false;
    const cancel = () => {
      stop = true;
    }
    return doUntil((cb) => {
      return setTimeout(() => {
        const acc = new Account();
        if (stop) return cb(null, null)
        return cb(null, acc);
      }, 0);
    }, (acc, cb) => {
      if (!acc) return cb(null, true);
      if (!prefix || typeof prefix !== 'string') return cb(null, true);
      const addr = acc.publicKey.toBase58();
      callback(addr, cancel);
      const pref = addr.substring(0, prefix.length);
      const ok = loose ? pref.toLowerCase() === prefix.toLowerCase() : pref === prefix;
      return cb(null, ok);
    }, (er, acc) => {
      if (er) return reject(er);
      if (acc) return resolve(acc);
    });
  });
}

account.deriveAssociatedAddress = async (
  walletAddress,
  mintAddress,
  spltPromgramAddress,
  splataProgramAddress
) => {
  if (!account.isAddress(walletAddress)) throw new Error('Invalid wallet address');
  if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
  if (!account.isAddress(spltPromgramAddress)) throw new Error('Invalid SPL token address');
  if (!account.isAddress(splataProgramAddress)) throw new Error('Invalid SPL associated token account address');
  const walletPublicKey = account.fromAddress(walletAddress);
  const mintPublicKey = account.fromAddress(mintAddress);
  const spltPublicKey = account.fromAddress(spltPromgramAddress);
  const splataPublicKey = account.fromAddress(splataProgramAddress);
  const [publicKey, _] = await PublicKey.findProgramAddress(
    [
      walletPublicKey.toBuffer(),
      spltPublicKey.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    splataPublicKey
  );
  return publicKey.toBase58();
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

account.sign = (msg, secretKey) => {
  if (typeof msg !== 'string') throw new Error('Message must be a string');
  const keyPair = account.fromSecretKey(secretKey);
  if (!keyPair) throw new Error('Invalid secret key');
  const address = keyPair.publicKey.toBase58();
  const bufSecretKey = keyPair.secretKey;
  const serializedData = Buffer.from(msg);
  const bufSig = nacl.sign(serializedData, bufSecretKey);
  const sig = Buffer.from(bufSig).toString('hex');
  return { address, sig, msg }
}

account.verify = (address, sig, msg = null) => {
  if (!account.isAddress(address)) throw new Error('Invalid address');
  if (typeof sig !== 'string') throw new Error('Signature must be a string');
  const publicKey = account.fromAddress(address).toBuffer();
  const bufSig = Buffer.from(sig, 'hex');
  const bufMsg = nacl.sign.open(bufSig, publicKey);
  const _msg = Buffer.from(bufMsg).toString('utf8');
  if (!_msg) return false;
  if (!msg) return _msg;
  if (msg && msg === _msg) return true;
  return false;
}

module.exports = account;