const account = require('./account');
const math = require('./math');
const keystore = require('./keystore');
const hdkey = require('./hdkey');
const util = require('./util');
const schema = require('./schema');
const Swap = require('./swap');
const LiteSwap = require('./liteSwap');
const { SPLT, AuthorityType } = require('./splt');
const Lamports = require('./lamports');
const oracle = require('./oracle');
const crypto = require('./crypto');
const { WalletInterface, SecretKeyWallet, KeystoreWallet, Coin98Wallet } = require('./wallet');

module.exports = {
  account, ...account,
  math, ...math,
  keystore, ...keystore,
  hdkey, ...hdkey,
  util, ...util,
  schema, ...schema,
  Swap,
  LiteSwap,
  SPLT,
  AuthorityType,
  Lamports,
  oracle, ...oracle,
  crypto,
  WalletInterface, SecretKeyWallet, KeystoreWallet, Coin98Wallet,
}