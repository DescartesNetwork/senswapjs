const Swap = require('./swap');
const { createAccount, createStrictAccount, deriveAssociatedAddress } = require('./account');
const {
  DEFAULT_SWAP_PROGRAM_ADDRESS,
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS
} = require('./default');


class LiteSwap {
  constructor(
    swapProgramAddress = DEFAULT_SWAP_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl,
  ) {
    this._swap = new Swap(swapProgramAddress, spltProgramAddress, splataProgramAddress, nodeUrl);
  }

  watchAndFetch = (callback) => {
    return this._swap.watchAndFetch(callback);
  }
  watch = (callback) => {
    return this._swap.watch(callback);
  }
  getPoolData = (poolAddress) => {
    return this._swap.getPoolData(poolAddress);
  }
  getLPTData = (lptAddress) => {
    return this._swap.getLPTData(lptAddress);
  }

  _getLPTAddress = (mintLPTAddress, wallet, autoCreating = true) => {
    return new Promise((resolve, reject) => {
      let lptAddress = '';
      return wallet.getAccount().then(payerAddress => {
        return deriveAssociatedAddress(
          payerAddress,
          mintLPTAddress,
          this._swap.spltProgramId.toBase58(),
          this._swap.splataProgramId.toBase58(),
        );
      }).then(associatedAccountAddress => {
        lptAddress = associatedAccountAddress;
        return this.getLPTData(lptAddress).then(data => {
          return resolve(lptAddress);
        }).catch(er => {
          if (!autoCreating) return reject(er);
          return this._swap.initializeLPT(lptAddress, mintLPTAddress, wallet);
        }).then(txId => {
          return resolve(lptAddress);
        }).catch(er => {
          return reject(er);
        });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Initialize Pool
   */
  initializePool = (reserveS, reserveA, reserveB, srcSAddress, srcAAddress, srcBAddress, wallet) => {
    let pool = null;
    let lptAddress = '';
    const mintLPT = createAccount();
    const mintLPTAddress = mintLPT.publicKey.toBase58();
    const vault = createAccount();
    let mintSAddress = '';
    const treasuryS = createAccount();
    let mintAAddress = '';
    const treasuryA = createAccount();
    let mintBAddress = '';
    const treasuryB = createAccount();
    return new Promise((resolve, reject) => {
      return createStrictAccount(this._swap.swapProgramId).then(strictAccount => {
        pool = strictAccount;
        return wallet.getAccount();
      }).then(payerAddress => {
        return deriveAssociatedAddress(
          payerAddress,
          mintLPTAddress,
          this._swap.spltProgramId.toBase58(),
          this._swap.splataProgramId.toBase58(),
        );
      }).then(associatedAccountAddress => {
        lptAddress = associatedAccountAddress;
        return this._swap._splt.getAccountData(srcSAddress)
      }).then(({ mint: { address } }) => {
        mintSAddress = address;
        return this._swap._splt.getAccountData(srcAAddress);
      }).then(({ mint: { address } }) => {
        mintAAddress = address;
        return this._swap._splt.getAccountData(srcBAddress);
      }).then(({ mint: { address } }) => {
        mintBAddress = address;
        return this._swap.initializePool(
          reserveS, reserveA, reserveB,
          pool, lptAddress, mintLPT, vault,
          srcSAddress, mintSAddress, treasuryS,
          srcAAddress, mintAAddress, treasuryA,
          srcBAddress, mintBAddress, treasuryB,
          wallet
        );
      }).then(txId => {
        return resolve({
          txId,
          poolAddress: pool.publicKey.toBase58(),
          lptAddress
        });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Initialize LPT
   */
  initializeLPT = (mintLPTAddress, wallet) => {
    return new Promise((resolve, reject) => {
      let lptAddress = '';
      return wallet.getAccount().then(payerAddress => {
        return deriveAssociatedAddress(
          payerAddress,
          mintLPTAddress,
          this._swap.spltProgramId.toBase58(),
          this._swap.splataProgramId.toBase58(),
        );
      }).then(associatedAccountAddress => {
        lptAddress = associatedAccountAddress;
        return this._swap.initializeLPT(lptAddress, mintLPTAddress, wallet);
      }).then(txId => {
        return resolve({ txId, lptAddress });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Add Liquidity
   */
  addLiquidity = (deltaS, deltaA, deltaB, poolAddress, srcSAddress, srcAAddress, srcBAddress, wallet) => {
    return new Promise((resolve, reject) => {
      let lptAddress = '';
      let data = {}
      return this._swap.getPoolData(poolAddress).then(re => {
        data = re;
        const { mint_lpt: { address: mintLPTAddress } } = data;
        return this._getLPTAddress(mintLPTAddress, wallet);
      }).then(({ lptAddress }) => {
        const {
          mint_lpt: { address: mintLPTAddress },
          treasury_s: { address: treasurySAddress },
          treasury_a: { address: treasuryAAddress },
          treasury_b: { address: treasuryBAddress },
        } = data;
        return this._swap.addLiquidity(
          deltaS, deltaA, deltaB,
          poolAddress, lptAddress, mintLPTAddress,
          srcSAddress, treasurySAddress,
          srcAAddress, treasuryAAddress,
          srcBAddress, treasuryBAddress,
          wallet
        );
      }).then(associatedAccountAddress => {
        lptAddress = associatedAccountAddress;
      }).then(txId => {
        return resolve({ txId, lptAddress });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Remove Liquidity
   */
  removeLiquidity = (lpt, poolAddress, dstSAddress, dstAAddress, dstBAddress, wallet) => {
    return new Promise((resolve, reject) => {
      let lptAddress = '';
      let mintLPTAddress = '';
      let treasurySAddress = '';
      let treasuryAAddress = '';
      let treasuryBAddress = '';
      return this._swap.getPoolData(poolAddress).then(data => {
        const {
          mint_lpt: { address: _mintLPTAddress },
          treasury_s: { address: _treasurySAddress },
          treasury_a: { address: _treasuryAAddress },
          treasury_b: { address: _treasuryBAddress },
        } = data;
        mintLPTAddress = _mintLPTAddress;
        treasurySAddress = _treasurySAddress;
        treasuryAAddress = _treasuryAAddress;
        treasuryBAddress = _treasuryBAddress;
        return this._getLPTAddress(mintLPTAddress, wallet, false);
      }).then(associatedAccountAddress => {
        lptAddress = associatedAccountAddress;
        return this._swap.removeLiquidity(
          lpt,
          poolAddress, lptAddress, mintLPTAddress,
          dstSAddress, treasurySAddress,
          dstAAddress, treasuryAAddress,
          dstBAddress, treasuryBAddress,
          wallet
        );
      }).then(txId => {
        return resolve({ txId, lptAddress });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Swap
   */
  swap = (amount, poolAddress, srcAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      let vaultAddress = '';
      let treasuryBidAddress = '';
      let treasuryAskAddress = '';
      let mintSAddress = '';
      let treasurySAddress = '';
      let mintAAddress = '';
      let treasuryAAddress = '';
      let mintBAddress = '';
      let treasuryBAddress = '';
      return this._swap.getPoolData(poolAddress).then(data => {
        const {
          vault: { address: _vaultAddress },
          treasury_s: { address: _treasurySAddress, mint: { address: _mintSAddress } },
          treasury_a: { address: _treasuryAAddress, mint: { address: _mintAAddress } },
          treasury_b: { address: _treasuryBAddress, mint: { address: _mintBAddress } },
        } = data;
        vaultAddress = _vaultAddress;
        mintSAddress = _mintSAddress;
        treasurySAddress = _treasurySAddress;
        mintAAddress = _mintAAddress;
        treasuryAAddress = _treasuryAAddress;
        mintBAddress = _mintBAddress;
        treasuryBAddress = _treasuryBAddress;
        return this._swap._splt.getAccountData(srcAddress);
      }).then(({ mint: { address } }) => {
        if (address == mintSAddress) treasuryBidAddress = treasurySAddress;
        if (address == mintAAddress) treasuryBidAddress = treasuryAAddress;
        if (address == mintBAddress) treasuryBidAddress = treasuryBAddress;
        return this._swap._splt.getAccountData(srcAddress);
      }).then(({ mint: { address } }) => {
        if (address == mintSAddress) treasuryAskAddress = treasurySAddress;
        if (address == mintAAddress) treasuryAskAddress = treasuryAAddress;
        if (address == mintBAddress) treasuryAskAddress = treasuryBAddress;
        if (!treasuryBidAddress) return reject('Invalid source address');
        if (!treasuryAskAddress) return reject('Invalid destination address');
        return this._swap.swap(
          amount,
          poolAddress, vaultAddress,
          srcAddress, treasuryBidAddress,
          dstAddress, treasuryAskAddress,
          treasurySAddress,
          wallet
        );
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Transfer
   */
  transfer = (lpt, srcLPTAddress, dstLPTAddress, wallet) => {
    return this._swap.transfer(lpt, srcLPTAddress, dstLPTAddress, wallet)
  }

  /**
   * Freeze pool
   */
  freezePool = (poolAddress, wallet) => {
    return this._swap.freezePool(poolAddress, wallet);
  }

  /**
   * Thaw pool
   */
  thawPool = (poolAddress, wallet) => {
    return this._swap.thawPool(poolAddress, wallet);
  }

  /**
   * Earn
   */
  earn = (amount, poolAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      return this._swap.getPoolData(poolAddress).then(data => {
        const { vault: { address: vaultAddress } } = data;
        return this._swap.earn(amount, poolAddress, vaultAddress, dstAddress, wallet);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Close LPT
   */
  closeLPT = (lptAddress, wallet) => {
    return this._swap.closeLPT(lptAddress, wallet);
  }

  /**
   * Transfer Ownership
   */
  transferPoolOwnership = (poolAddress, newOwnerAddress, wallet) => {
    return this._swap.transferPoolOwnership(poolAddress, newOwnerAddress, wallet);
  }
}

module.exports = LiteSwap;