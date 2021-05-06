const Swap = require('./splt');
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

  /**
   * Initialize Pool
   */
  initializePool = (
    reserveS, reserveA, reserveB,
    pool, lptAddress, mintLPT, vault,
    srcSAddress, treasuryS,
    srcAAddress, treasuryA,
    srcBAddress, treasuryB,
    wallet
  ) => {
    let mintSAddress = '';
    let mintAAddress = '';
    let mintBAddress = '';
    return new Promise((resolve, reject) => {
      return this._swap._splt.getAccountData(srcSAddress).then(({ mint: { address } }) => {
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
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Initialize LPT
   */
  initializeLPT = (lptAccountOrAddress, mintLPTAddress, wallet) => {
    return this._swap.initializeLPT(lptAccountOrAddress, mintLPTAddress, wallet);
  }

  /**
   * Add Liquidity
   */
  addLiquidity = (
    deltaS, deltaA, deltaB,
    poolAddress, lptAddress,
    srcSAddress, srcAAddress, srcBAddress,
    wallet
  ) => {
    return new Promise((resolve, reject) => {
      return this._swap.getPoolData(poolAddress).then(data => {
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
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  /**
   * Remove Liquidity
   */
  removeLiquidity = (
    lpt,
    poolAddress, lptAddress,
    dstSAddress,
    dstAAddress,
    dstBAddress,
  ) => {
    return new Promise((resolve, reject) => {
      return this._swap.getPoolData(poolAddress).then(data => {
        const {
          mint_lpt: { address: mintLPTAddress },
          treasury_s: { address: treasurySAddress },
          treasury_a: { address: treasuryAAddress },
          treasury_b: { address: treasuryBAddress },
        } = data;
        return this._swap.removeLiquidity(
          lpt,
          poolAddress, lptAddress, mintLPTAddress,
          dstSAddress, treasurySAddress,
          dstAAddress, treasuryAAddress,
          dstBAddress, treasuryBAddress,
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
   * Swap
   */
  swap = (
    amount,
    poolAddress,
    srcAddress, treasuryBidAddress,
    dstAddress, treasuryAskAddress,
    wallet
  ) => {
    return new Promise((resolve, reject) => {
      return this._swap.getPoolData(poolAddress).then(data => {
        const {
          vault: { address: vaultAddress },
          treasury_s: { address: treasurySenAddress },
        } = data;
        return this._swap.swap(
          amount,
          poolAddress, vaultAddress,
          srcAddress, treasuryBidAddress,
          dstAddress, treasuryAskAddress,
          treasurySenAddress,
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