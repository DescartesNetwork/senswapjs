const bs58 = require('bs58')

const account = require('../account')
const storage = require('./storage')
const WalletInterface = require('./walletInterface')

class PhantomWallet extends WalletInterface {
  constructor() {
    super()

    this._setWallet()
  }

  _setWallet = () => {
    storage.set('WalletType', 'Phantom')
  }

  _getNode = () => {
    return new Promise((resolve, reject) => {
      const { solana } = window
      if (!solana?.isPhantom) reject('Wallet is not connected')
      if (solana.isConnected) return resolve(solana)
      solana.connect()
      return solana.on('connect', () => resolve(solana))
    })
  }

  _getAccount = async () => {
    const node = await this._getNode()
    const acc = node.publicKey.toString()
    if (!acc) throw new Error('There is no Solana account')
    return acc
  }

  _sign = async (transaction) => {
    const node = await this._getNode()
    const acc = await this.getAccount()
    transaction.feePayer = account.fromAddress(acc)
    const { signature } = await node.signTransaction(transaction)
    const publicKey = account.fromAddress(acc)
    return { publicKey, signature }
  }

  _certify = async (msg) => {
    const node = await this._getNode()
    const address = await this._getAccount()
    const { signature } = await node.signMessage(msg, 'utf8')
    const sig = bs58.encode(Buffer.from(signature))
    const data = { address, sig, msg }
    return data
  }

  _verify = async (sig, msg = null) => {
    const addr = await this._getAccount()
    const data = await account.verify(addr, sig, msg)
    return data
  }

  _disconnect = async () => {
    const node = await this._getNode()
    storage.clear('WalletType')
    node.disconnect()
  }
}

module.exports = PhantomWallet
