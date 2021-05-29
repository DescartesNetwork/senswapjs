import { SPLT } from './splt';
const { deriveAssociatedAddress } = require('./account');
const {
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
  DEFAULT_WSOL,
} = require('./defaults');

class LiteSPLT {
  constructor(
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl,
  ) {
    this._splt = new SPLT(spltProgramAddress, splataProgramAddress, nodeUrl);
  }

  watchAndFetch = (callback) => {
    return this._splt.watchAndFetch(callback);
  }
  watch = (callback) => {
    return this._splt.watch(callback);
  }
  getMintData = async (mintAddress) => {
    return await this._splt.getMintData(mintAddress);
  }
  getAccountData = async (accountAddress) => {
    return await this._splt.getAccountData(accountAddress);
  }
  getMultiSigData = async (multiSigAddress) => {
    return await this._splt.getMultiSigData(multiSigAddress);
  }

  initializeMint = async (decimals, mintAuthorityAddress, freezeAuthorityAddress, mint, wallet) => {
    return await this._splt.initializeMint(decimals, mintAuthorityAddress, freezeAuthorityAddress, mint, wallet);
  }

  initializeAccount = async (mintAddress, wallet, ownerAddress = null) => {
    // Get payer
    const payerAddress = await wallet.getAccount();
    const accountAddress = await deriveAssociatedAddress(
      ownerAddress || payerAddress,
      mintAddress,
      this._splt.spltProgramId.toBase58(),
      this._splt.splataProgramId.toBase58(),
    );
    const txId = await this._splt.initializeAccount(accountAddress, mintAddress, wallet, ownerAddress);
    return { accountAddress, txId }
  }

  initializeMultiSig = async (minimumSig, signerAddresses, multiSig, wallet) => {
    return await this._splt.initializeMultiSig(minimumSig, signerAddresses, multiSig, wallet);
  }

  transfer = async (amount, srcAddress, dstAddress, wallet) => {
    return await this._splt.transfer(amount, srcAddress, dstAddress, wallet);
  }

  approve = async (amount, srcAddress, delegateAddress, wallet) => {
    return await this._splt.approve(amount, srcAddress, delegateAddress, wallet);
  }

  revoke = async (srcAddress, wallet) => {
    return await this._splt.revoke(srcAddress, wallet);
  }

  setAuthority = async (authorityType, newAuthorityAddress, targetAddress, wallet) => {
    return await this._splt.setAuthority(authorityType, newAuthorityAddress, targetAddress, wallet);
  }

  mintTo = async (amount, mintAddress, dstAddress, wallet) => {
    return await this._splt.mintTo(amount, mintAddress, dstAddress, wallet);
  }

  burn = async (amount, srcAddress, mintAddress, wallet) => {
    return await this._splt.burn(amount, srcAddress, mintAddress, wallet);
  }

  closeAccount = async (targetAccount, wallet) => {
    return await this._splt.closeAccount(targetAccount, wallet);
  }

  freezeAccount = async (targetAddress, mintAddress, wallet) => {
    return await this._splt.freezeAccount(targetAddress, mintAddress, wallet);
  }

  thawAccount = async (targetAddress, mintAddress, wallet) => {
    return await this._splt.thawAccount(targetAddress, mintAddress, wallet);
  }

  wrap = async (lamports, wallet, ownerAddress = null) => {
    // Get payer
    const payerAddress = await wallet.getAccount();
    const accountAddress = await deriveAssociatedAddress(
      ownerAddress || payerAddress,
      DEFAULT_WSOL,
      this._splt.spltProgramId.toBase58(),
      this._splt.splataProgramId.toBase58(),
    );
    const txId = await this._splt.wrap(lamports, accountAddress, wallet, ownerAddress);
    return { accountAddress, txId }
  }

  unwrap = async (targetAddress, wallet) => {
    return await this._splt.unwrap(targetAddress, wallet);
  }
}

module.exports = LiteSPLT;