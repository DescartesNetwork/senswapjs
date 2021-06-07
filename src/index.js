const account = require('./account');
const defaults = require('./defaults');
const math = require('./math');
const keystore = require('./keystore');
const hdkey = require('./hdkey');
const util = require('./util');
const schema = require('./schema');
const Swap = require('./swap');
const LiteSwap = require('./liteSwap');
const { SPLT, AuthorityType } = require('./splt');
const LiteSPLT = require('./liteSPLT');
const Lamports = require('./lamports');
const Farming = require('./farming');
const LiteFarming = require('./liteFarming');
const oracle = require('./oracle');
const crypto = require('./crypto');
const {
  WalletInterface, RawWallet,
  SecretKeyWallet, KeystoreWallet, Coin98Wallet
} = require('./wallet');

module.exports = {
  account, ...account,
  defaults, ...defaults,
  math, ...math,
  keystore, ...keystore,
  hdkey, ...hdkey,
  util, ...util,
  schema, ...schema,
  Swap, LiteSwap,
  SPLT, AuthorityType, LiteSPLT,
  Lamports,
  Farming, LiteFarming,
  oracle, ...oracle,
  crypto,
  WalletInterface, RawWallet,
  SecretKeyWallet, KeystoreWallet, Coin98Wallet,
}