const Swap = require('./swap');
const { createAccount, createStrictAccount, deriveAssociatedAddress } = require('./account');
const {
  DEFAULT_SWAP_PROGRAM_ADDRESS,
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS
} = require('./defaults');


class LiteSwap {
  constructor(
    swapProgramAddress = DEFAULT_SWAP_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl,
  ) {
    this._swap = new Swap(swapProgramAddress, spltProgramAddress, splataProgramAddress, nodeUrl);
  }

  /**
   * Watch and return changed data
   */
  watchAndFetch = (callback) => {
    return this._swap.watchAndFetch(callback);
  }

  /**
   * Watch only
   */
  watch = (callback) => {
    return this._swap.watch(callback);
  }

  /**
   * Get pool data
   */
  getPoolData = async (poolAddress) => {
    return await this._swap.getPoolData(poolAddress);
  }

  /**
   * Get lpt data
   */
  getLPTData = async (lptAddress) => {
    return await this._swap.getLPTData(lptAddress);
  }

  /**
   * Derive pool address
   */
  derivePoolAddress = async (mintAuthorityAddress, freezeAuthorityAddress) => {
    return await this._swap.derivePoolAddress(mintAuthorityAddress, freezeAuthorityAddress);
  }

  /**
   * Derive lpt address
   */
  _deriveLPTAddress = async (mintLPTAddress, wallet, autoCreating = true) => {
    const payerAddress = await wallet.getAccount()
    const lptAddress = await deriveAssociatedAddress(
      payerAddress,
      mintLPTAddress,
      this._swap.spltProgramId.toBase58(),
      this._swap.splataProgramId.toBase58(),
    );
    try {
      await this.getLPTData(lptAddress);
      return lptAddress;
    } catch (er) {
      if (!autoCreating) throw new Error(er);
      await this._swap.initializeLPT(lptAddress, mintLPTAddress, wallet);
      return lptAddress;
    }
  }

  /**
   * Initialize Pool
   */
  initializePool = async (reserveS, reserveA, reserveB, srcSAddress, srcAAddress, srcBAddress, ownerAddress, wallet) => {
    const mintLPT = createAccount();
    const vault = createAccount();
    const pool = await createStrictAccount(this._swap.swapProgramId);
    const payerAddress = await wallet.getAccount();
    const lptAddress = await deriveAssociatedAddress(
      payerAddress,
      mintLPT.publicKey.toBase58(),
      this._swap.spltProgramId.toBase58(),
      this._swap.splataProgramId.toBase58(),
    );
    const { mint: { address: mintSAddress } } = await this._swap._splt.getAccountData(srcSAddress);
    const { mint: { address: mintAAddress } } = await this._swap._splt.getAccountData(srcAAddress);
    const { mint: { address: mintBAddress } } = await this._swap._splt.getAccountData(srcBAddress);
    const txId = await this._swap.initializePool(
      reserveS, reserveA, reserveB,
      ownerAddress, pool, lptAddress, mintLPT, vault,
      srcSAddress, mintSAddress,
      srcAAddress, mintAAddress,
      srcBAddress, mintBAddress,
      wallet
    );
    return { txId, poolAddress: pool.publicKey.toBase58(), lptAddress }
  }

  /**
   * Initialize LPT
   */
  initializeLPT = async (mintLPTAddress, wallet) => {
    const payerAddress = await wallet.getAccount();
    const lptAddress = await deriveAssociatedAddress(
      payerAddress,
      mintLPTAddress,
      this._swap.spltProgramId.toBase58(),
      this._swap.splataProgramId.toBase58(),
    );
    const txId = await this._swap.initializeLPT(lptAddress, mintLPTAddress, wallet);
    return { txId, lptAddress }
  }

  /**
   * Add Liquidity
   */
  addLiquidity = async (deltaS, deltaA, deltaB, poolAddress, srcSAddress, srcAAddress, srcBAddress, wallet) => {
    const data = await this._swap.getPoolData(poolAddress);
    const {
      mint_lpt: { address: mintLPTAddress },
      mint_s: { address: mintSAddress },
      mint_a: { address: mintAAddress },
      mint_b: { address: mintBAddress },
    } = data;
    const lptAddress = await this._deriveLPTAddress(mintLPTAddress, wallet);
    const txId = await this._swap.addLiquidity(
      deltaS, deltaA, deltaB,
      poolAddress, lptAddress, mintLPTAddress,
      srcSAddress, mintSAddress,
      srcAAddress, mintAAddress,
      srcBAddress, mintBAddress,
      wallet
    );
    return { txId, lptAddress };
  }

  /**
   * Remove Liquidity
   */
  removeLiquidity = async (lpt, poolAddress, dstSAddress, dstAAddress, dstBAddress, wallet) => {
    const data = await this._swap.getPoolData(poolAddress);
    const {
      mint_lpt: { address: mintLPTAddress },
      mint_s: { address: mintSAddress },
      mint_a: { address: mintAAddress },
      mint_b: { address: mintBAddress },
    } = data;
    const lptAddress = await this._deriveLPTAddress(mintLPTAddress, wallet, false);
    const txId = await this._swap.removeLiquidity(
      lpt,
      poolAddress, lptAddress, mintLPTAddress,
      dstSAddress, mintSAddress,
      dstAAddress, mintAAddress,
      dstBAddress, mintBAddress,
      wallet
    );
    return { txId, lptAddress };
  }

  /**
   * Swap
   */
  swap = async (amount, limit, poolAddress, srcAddress, dstAddress, wallet) => {
    const data = await this._swap.getPoolData(poolAddress);
    const { vault: { address: vaultAddress }, treasury_s: treasurySAddress } = data;
    const { mint: { address: mintBidAddress } } = await this._swap._splt.getAccountData(srcAddress);
    const { mint: { address: mintAskAddress } } = await this._swap._splt.getAccountData(dstAddress);
    const txId = await this._swap.swap(
      amount, limit,
      poolAddress, vaultAddress,
      srcAddress, mintBidAddress,
      dstAddress, mintAskAddress,
      treasurySAddress,
      wallet
    );
    return txId;
  }

  /**
   * Transfer
   */
  transfer = async (lpt, srcLPTAddress, dstLPTAddress, wallet) => {
    return await this._swap.transfer(lpt, srcLPTAddress, dstLPTAddress, wallet);
  }

  /**
   * Freeze pool
   */
  freezePool = async (poolAddress, wallet) => {
    return await this._swap.freezePool(poolAddress, wallet);
  }

  /**
   * Thaw pool
   */
  thawPool = async (poolAddress, wallet) => {
    return await this._swap.thawPool(poolAddress, wallet);
  }

  /**
   * Earn
   */
  earn = async (amount, poolAddress, dstAddress, wallet) => {
    const { vault: { address: vaultAddress } } = await this._swap.getPoolData(poolAddress);
    const txId = await this._swap.earn(amount, poolAddress, vaultAddress, dstAddress, wallet);
    return txId;
  }

  /**
   * Close LPT
   */
  closeLPT = async (lptAddress, wallet) => {
    return await this._swap.closeLPT(lptAddress, wallet);
  }

  /**
   * Transfer Ownership
   */
  transferPoolOwnership = async (poolAddress, newOwnerAddress, wallet) => {
    return await this._swap.transferPoolOwnership(poolAddress, newOwnerAddress, wallet);
  }
}

module.exports = LiteSwap;