const WalletInterface = require('./walletInterface');
const RawWallet = require('./rawWallet');
const SecretKeyWallet = require('./secretKeyWallet');
const KeystoreWallet = require('./keystoreWallet');
const Coin98Wallet = require('./coin98Wallet');

module.exports = {
  WalletInterface, RawWallet,
  SecretKeyWallet, KeystoreWallet, Coin98Wallet
}