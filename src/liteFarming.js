const Farming = require('./farming');
const { createAccount } = require('./account');
const {
  DEFAULT_FARMING_PROGRAM_ADDRESS,
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS
} = require('./defaults');

class LiteFarming {
  constructor(
    farmingProgramAddress = DEFAULT_FARMING_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl,
  ) {
    this._farming = new Farming(farmingProgramAddress, spltProgramAddress, splataProgramAddress, nodeUrl);
  }

  /**
   * Watch and return changed data
   */
  watchAndFetch = (callback) => {
    return this._farming.watchAndFetch(callback);
  }

  /**
   * Watch only
   */
  watch = (callback) => {
    return this._farming.watch(callback);
  }

  deriveStakePoolAddress = async (mintAuthorityAddress, freezeAuthorityAddress) => {
    return await this._farming.deriveStakePoolAddress(mintAuthorityAddress, freezeAuthorityAddress);
  }

  getStakePoolData = async (stakePoolAddress) => {
    return await this._farming.getStakePoolData(stakePoolAddress);
  }

  getStakeAccountData = async (stakePoolAddress, wallet) => {
    const ownerAddress = await wallet.getAccount();
    const debtData = await this._farming._deriveDebtAddress(ownerAddress, stakePoolAddress);
    return debtData;
  }

  /**
   * Initialize Stake Pool
   */
  initializeStakePool = async (reward, period, ownerAddress, mintTokenAddress, mintSenAddress, wallet) => {
    const stakePool = createAccount();
    const stakePoolAddress = stakePool.publicKey.toBase58();
    const mintShare = createAccount();
    const mintShareAddress = mintShare.publicKey.toBase58();
    const txId = await this._farming.initializeStakePool(
      reward, period,
      ownerAddress, stakePool, mintShare,
      mintTokenAddress, mintSenAddress,
      wallet
    );
    return { txId, stakePoolAddress, mintShareAddress }
  }

  /**
   * Initialize Account
   */
  initializeAccount = async (stakePoolAddress, wallet) => {
    const ownerAddress = await wallet.getAccount();
    const { mint_share: { address: mintShareAddress } } = await this._farming.getStakePoolData(stakePoolAddress);
    return await this._farming.initializeAccount(ownerAddress, stakePoolAddress, mintShareAddress, wallet);
  }

  /**
   * Stake
   */
  stake = async (amount, stakePoolAddress, srcAddress, dstSenAddress, wallet) => {
    const {
      mint_share: { address: mintShareAddress },
      treasury_token: { address: treasuryTokenAddress },
      treasury_sen: { address: treasurySenAddress }
    } = await this._farming.getStakePoolData(stakePoolAddress);
    const {
      address: debtAddress,
      account: { address: shareAddress }
    } = await this.getStakeAccountData(stakePoolAddress, wallet);
    return await this._farming.stake(
      amount,
      stakePoolAddress, mintShareAddress,
      srcAddress, treasuryTokenAddress,
      shareAddress, debtAddress,
      dstSenAddress, treasurySenAddress,
      wallet,
    );
  }

  /**
   * Unstake
   */
  unstake = async (amount, stakePoolAddress, dstAddress, dstSenAddress, wallet) => {
    const {
      mint_share: { address: mintShareAddress },
      treasury_token: { address: treasuryTokenAddress },
      treasury_sen: { address: treasurySenAddress }
    } = await this._farming.getStakePoolData(stakePoolAddress);
    const {
      address: debtAddress,
      account: { address: shareAddress }
    } = await this.getStakeAccountData(stakePoolAddress, wallet);
    return await this._farming.unstake(
      amount,
      stakePoolAddress, mintShareAddress,
      dstAddress, treasuryTokenAddress,
      shareAddress, debtAddress,
      dstSenAddress, treasurySenAddress,
      wallet,
    );
  }

  /**
   * Harvest
   */
  harvest = async (stakePoolAddress, dstSenAddress, wallet) => {
    const {
      mint_share: { address: mintShareAddress },
      treasury_sen: { address: treasurySenAddress }
    } = await this._farming.getStakePoolData(stakePoolAddress);
    const {
      address: debtAddress,
      account: { address: shareAddress }
    } = await this.getStakeAccountData(stakePoolAddress, wallet);
    return await this._farming.harvest(
      stakePoolAddress, mintShareAddress,
      shareAddress, debtAddress,
      dstSenAddress, treasurySenAddress,
      wallet
    );
  }

  /**
   * Seed
   */
  seed = async (amount, stakePoolAddress, srcSenAddress, wallet) => {
    const { treasury_sen: { address: treasurySenAddress } } = await this._farming.getStakePoolData(stakePoolAddress);
    return await this._farming.seed(amount, stakePoolAddress, srcSenAddress, treasurySenAddress, wallet);
  }

  /**
   * Unseed
   */
  unseed = async (amount, stakePoolAddress, dstSenAddress, wallet) => {
    const { treasury_sen: { address: treasurySenAddress } } = await this._farming.getStakePoolData(stakePoolAddress);
    return await this._farming.unseed(amount, stakePoolAddress, dstSenAddress, treasurySenAddress, wallet)
  }

  /**
   * Transfer
   */
  transfer = async (shares, srcShareAddress, dstShareAddress, wallet) => {
    return await this._farming.transfer(shares, srcShareAddress, dstShareAddress, wallet);
  }

  /**
   * Freeze stake pool
   */
  freezeStakePool = async (stakePoolAddress, wallet) => {
    return await this._farming.freezeStakePool(stakePoolAddress, wallet);
  }

  /**
   * Thaw stake pool
   */
  thawStakePool = async (stakePoolAddress, wallet) => {
    return await this._farming.thawStakePool(stakePoolAddress, wallet);
  }

  /**
   * Close share
   */
  closeShare = async (shareAddress, wallet) => {
    return await this._farming.closeShare(shareAddress, wallet);
  }

  /**
   * Transfer Ownership
   */
  transferStakePoolOwnership = async (stakePoolAddress, newOwnerAddress, wallet) => {
    return await this._farming.transferStakePoolOwnership(stakePoolAddress, newOwnerAddress, wallet);
  }
}

module.exports = LiteFarming;