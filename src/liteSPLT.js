import { SPLT } from './splt';
const { deriveAssociatedAddress } = require('./account');
const {
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS
} = require('./default');

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
  getMintData = (mintAddress) => {
    return this._splt.getMintData(mintAddress);
  }
  getAccountData = (accountAddress) => {
    return this._splt.getAccountData(accountAddress);
  }
  getMultiSigData = (multiSigAddress) => {
    return this._splt.getMultiSigData(multiSigAddress);
  }

  initializeMint = (decimals, mintAuthorityAddress, freezeAuthorityAddress, mint, wallet) => {
    return this._splt.initializeMint(decimals, mintAuthorityAddress, freezeAuthorityAddress, mint, wallet);
  }

  initializeAccount = (mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      let accountAddress = null;
      return wallet.getAccount().then(walletAddress => {
        return deriveAssociatedAddress(
          walletAddress,
          mintAddress,
          this._splt.spltProgramId.toBase58(),
          this._splt.splataProgramId.toBase58(),
        );
      }).then(associatedAccountAddress => {
        accountAddress = associatedAccountAddress;
        return this._splt.initializeAccount(associatedAccountAddress, mintAddress, wallet);
      }).then(txId => {
        return resolve({ accountAddress, txId });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializeMultiSig = (minimumSig, signerAddresses, multiSig, wallet) => {
    return this._splt.initializeMultiSig(minimumSig, signerAddresses, multiSig, wallet);
  }

  transfer = (amount, srcAddress, dstAddress, wallet) => {
    return this._splt.transfer(amount, srcAddress, dstAddress, wallet);
  }

  approve = (amount, srcAddress, delegateAddress, wallet) => {
    return this._splt.approve(amount, srcAddress, delegateAddress, wallet);
  }

  revoke = (srcAddress, wallet) => {
    return this._splt.revoke(srcAddress, wallet);
  }

  setAuthority = (authorityType, newAuthorityAddress, targetAddress, wallet) => {
    return this._splt.setAuthority(authorityType, newAuthorityAddress, targetAddress, wallet);
  }

  mintTo = (amount, mintAddress, dstAddress, wallet) => {
    return this._splt.mintTo(amount, mintAddress, dstAddress, wallet);
  }

  burn = (amount, srcAddress, mintAddress, wallet) => {
    return this._splt.burn(amount, srcAddress, mintAddress, wallet);
  }

  closeAccount = (targetAccount, wallet) => {
    return this._splt.closeAccount(targetAccount, wallet);
  }

  freezeAccount = (targetAddress, mintAddress, wallet) => {
    return this._splt.freezeAccount(targetAddress, mintAddress, wallet);
  }

  thawAccount = (targetAddress, mintAddress, wallet) => {
    return this._splt.thawAccount(targetAddress, mintAddress, wallet);
  }
}

module.exports = LiteSPLT;