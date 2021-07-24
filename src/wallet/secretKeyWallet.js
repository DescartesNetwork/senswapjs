const nacl = require('tweetnacl')

const account = require('../account')
const storage = require('./storage')
const WalletInterface = require('./walletInterface')

class SecretKeyWallet extends WalletInterface {
  constructor(secretKey) {
    super()

    this._setWallet(secretKey)
  }

  _setWallet = (secretKey) => {
    storage.set('WalletType', 'SecretKey')
    storage.set('SecretKey', secretKey)
  }

  _getWallet = () => {
    const secretKey = storage.get('SecretKey')
    const acc = account.fromSecretKey(secretKey)
    return acc
  }

  _getAccount = async () => {
    const acc = this._getWallet()
    if (!acc || !acc.publicKey) throw new Error('No account')
    const address = acc.publicKey.toBase58()
    return address
  }

  _sign = (tx) => {
    const confirmed = window.confirm('Please confirm to sign the transaction!')
    if (!confirmed) throw new Error('User rejects to sign the transaction')
    const acc = this._getWallet()
    const signData = tx.serializeMessage()
    const publicKey = acc.publicKey
    const signature = nacl.sign.detached(signData, acc.secretKey)
    return { publicKey, signature }
  }

  _certify = async (msg) => {
    if (!msg || typeof msg != 'string')
      throw new Error('Message must be a string')
    const confirmed = window.confirm(
      `Please confirm to certify the message! Message: ${msg}`,
    )
    if (!confirmed) throw new Error('User rejects to certify the message')
    const secretKey = storage.get('SecretKey')
    const data = account.sign(msg, secretKey)
    return { ...data }
  }

  _verify = async (sig, msg = null) => {
    const acc = this._getWallet()
    const addr = acc.publicKey.toBase58()
    const data = account.verify(addr, sig, msg)
    return data
  }

  _disconnect = async () => {
    storage.clear('WalletType')
    storage.clear('SecretKey')
  }
}

module.exports = SecretKeyWallet
