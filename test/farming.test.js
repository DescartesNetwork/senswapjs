const { PublicKey } = require('@solana/web3.js');
const {
  createAccount, createStrictAccount, deriveAssociatedAddress,
  Farming, SPLT, RawWallet, Lamports,
} = require('../dist');

const payer = new RawWallet('e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720');
// Primary Mint
let MINT_ADDRESS_0 = '';
let ACCOUNT_ADDRESS_0 = '';
// Mint 1
let MINT_ADDRESS_1 = '';
let ACCOUNT_ADDRESS_1 = '';
let SHARE_ADDRESS = '';
let DEBT_ADDRESS = '';
// Stake Pool
let STAKE_POOL_ADDRESS = '';
let MINT_SHARE_ADDRESS = '';
let TREASURY_TOKEN_ADDRESS = '';
let TREASURY_SEN_ADDRESS = '';

describe('Farming library', function () {
  it('Mint 0', async function () {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_0 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_0 = account.publicKey.toBase58();
    const splt = new SPLT();
    const payerAddress = await payer.getAccount();
    await splt.initializeMint(9, payerAddress, null, mint, payer);
    await splt.initializeAccount(account, MINT_ADDRESS_0, payer);
    await splt.mintTo(5000000000000000000n, MINT_ADDRESS_0, ACCOUNT_ADDRESS_0, payer);
  });

  it('Mint 1', async function () {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_1 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_1 = account.publicKey.toBase58();
    const splt = new SPLT();
    const payerAddress = await payer.getAccount();
    await splt.initializeMint(9, payerAddress, null, mint, payer);
    await splt.initializeAccount(account, MINT_ADDRESS_1, payer);
    await splt.mintTo(5000000000000000000n, MINT_ADDRESS_1, ACCOUNT_ADDRESS_1, payer);
  });

  it('Stake Pool', async function () {
    const farming = new Farming();
    const stakePool = await createStrictAccount(farming.farmingProgramId);
    const mintShare = createAccount();
    const payerAddress = await payer.getAccount();
    const seed = [stakePool.publicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, farming.farmingProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();

    STAKE_POOL_ADDRESS = stakePool.publicKey.toBase58();
    MINT_SHARE_ADDRESS = mintShare.publicKey.toBase58();
    TREASURY_SEN_ADDRESS = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_0,
      farming.spltProgramId.toBase58(),
      farming.splataProgramId.toBase58(),
    );
    TREASURY_TOKEN_ADDRESS = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_1,
      farming.spltProgramId.toBase58(),
      farming.splataProgramId.toBase58(),
    );

    await farming.initializeStakePool(
      1000000000n, 5n,
      payerAddress, stakePool, mintShare,
      MINT_ADDRESS_1, MINT_ADDRESS_0,
      payer
    );
  });

  describe('Test constructor', function () {
    it('Should fill configs', async function () {
      // Payer
      const payerAddress = await payer.getAccount();
      console.log('PAYER:', payerAddress);
      console.log('\n');
      // Mint 0
      console.log('MINT_ADDRESS_0:', MINT_ADDRESS_0);
      console.log('ACCOUNT_ADDRESS_0:', ACCOUNT_ADDRESS_0);
      console.log('\n');
      // Mint 1
      console.log('MINT_ADDRESS_1:', MINT_ADDRESS_1);
      console.log('ACCOUNT_ADDRESS_1:', ACCOUNT_ADDRESS_1);
      console.log('\n');
      // Pool 0
      console.log('STAKE_POOL_ADDRESS:', STAKE_POOL_ADDRESS);
      console.log('MINT_SHARE_ADDRESS:', MINT_SHARE_ADDRESS);
      console.log('TREASURY_TOKEN_ADDRESS:', TREASURY_TOKEN_ADDRESS);
      console.log('TREASURY_SEN_ADDRESS:', TREASURY_SEN_ADDRESS);
      console.log('\n');
    });

    it('Should be a valid default in constructor', function () {
      new Farming();
    });

    it('Should be a valid address in constructor', function () {
      new Farming('F5SvYWVLivzKc8XjoKaKxeXe2Yo8YZbJtbPbvq3b2sGj');
    });

    it('Should be an invalid address in constructor', function () {
      try {
        new Farming('abc');
        throw new Error('No error');
      } catch (er) {
        if (er.message === 'No error') throw new Error('An invalid address is skipped');
      }
    });
  });

  describe('Test Stake Pool', function () {
    it('Should be a valid pool data', async function () {
      const farming = new Farming();
      await farming.getStakePoolData(STAKE_POOL_ADDRESS);
    });

    it('Should seed', async function () {
      const farming = new Farming();
      await farming.seed(
        1000000000000n,
        STAKE_POOL_ADDRESS,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        payer
      );
    });

    it('Should unseed', async function () {
      const farming = new Farming();
      await farming.unseed(
        900000000000n,
        STAKE_POOL_ADDRESS,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        payer
      );
    });
  });

  describe('Test accounts', function () {
    it('Should initialize share & debt account', async function () {
      const farming = new Farming();
      const payerAddress = await payer.getAccount();
      const { shareAddress, debtAddress } = await farming.initializeAccount(
        payerAddress,
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        payer
      );
      SHARE_ADDRESS = shareAddress;
      DEBT_ADDRESS = debtAddress;
    });

    it('Should be a debt data', async function () {
      const farming = new Farming();
      await farming.getDebtData(DEBT_ADDRESS);
    });

    it('Should stake', async function () {
      const farming = new Farming();
      await (async () => new Promise((resolve, _) => setTimeout(resolve, 10000)))();
      await farming.stake(
        10000000000n,
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        ACCOUNT_ADDRESS_1,
        TREASURY_TOKEN_ADDRESS,
        SHARE_ADDRESS,
        DEBT_ADDRESS,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        payer
      );
      await (async () => new Promise((resolve, _) => setTimeout(resolve, 10000)))();
      await farming.stake(
        10000000000n,
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        ACCOUNT_ADDRESS_1,
        TREASURY_TOKEN_ADDRESS,
        SHARE_ADDRESS,
        DEBT_ADDRESS,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        payer
      );
    });

    it('Should add more stakers', async function () {
      const splt = new SPLT();
      const farming = new Farming();
      const lamports = new Lamports()
      // Create & fund wallet
      const wallet = new RawWallet(Buffer.from(createAccount().secretKey).toString('hex'));
      const walletAddress = await wallet.getAccount();
      await lamports.transfer(10000000n, walletAddress, payer);
      // Fund account
      const srcAddress = await deriveAssociatedAddress(
        walletAddress,
        MINT_ADDRESS_1,
        farming.spltProgramId.toBase58(),
        farming.splataProgramId.toBase58(),
      );
      await splt.initializeAccount(srcAddress, MINT_ADDRESS_1, wallet);
      await splt.transfer(10000000000n, ACCOUNT_ADDRESS_1, srcAddress, payer);
      // Stake
      const { shareAddress, debtAddress } = await farming.initializeAccount(
        walletAddress,
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        wallet
      );
      await (async () => new Promise((resolve, _) => setTimeout(resolve, 10000)))();
      await farming.stake(
        10000000000n,
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        srcAddress,
        TREASURY_TOKEN_ADDRESS,
        shareAddress,
        debtAddress,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        wallet
      );
    });

    it('Should unstake', async function () {
      const farming = new Farming();
      await (async () => new Promise((resolve, _) => setTimeout(resolve, 10000)))();
      await farming.unstake(
        10000000000n,
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        ACCOUNT_ADDRESS_1,
        TREASURY_TOKEN_ADDRESS,
        SHARE_ADDRESS,
        DEBT_ADDRESS,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        payer
      );
    });

    it('Should havest', async function () {
      const farming = new Farming();
      await (async () => new Promise((resolve, _) => setTimeout(resolve, 10000)))();
      await farming.havest(
        STAKE_POOL_ADDRESS,
        MINT_SHARE_ADDRESS,
        SHARE_ADDRESS,
        DEBT_ADDRESS,
        ACCOUNT_ADDRESS_0,
        TREASURY_SEN_ADDRESS,
        payer
      );
    });
  });

  describe('Test stake pool owner', function () {
    it('Should freeze/thaw stake pool', async function () {
      const farming = new Farming();
      await farming.freezeStakePool(STAKE_POOL_ADDRESS, payer);
      const a = await farming.getStakePoolData(STAKE_POOL_ADDRESS);
      if (a.state != 2) throw new Error('Cannot freeze stake pool');
      await farming.thawStakePool(STAKE_POOL_ADDRESS, payer);
      const b = await farming.getStakePoolData(STAKE_POOL_ADDRESS);
      if (b.state != 1) throw new Error('Cannot thaw stake pool');
    });

    it('Should transfer stake pool ownership', async function () {
      const farming = new Farming();
      const newOwnerAddress = createAccount().publicKey.toBase58();
      await farming.transferStakePoolOwnership(STAKE_POOL_ADDRESS, newOwnerAddress, payer);
      const data = await farming.getStakePoolData(STAKE_POOL_ADDRESS);
      if (data.owner != newOwnerAddress) throw new Error('Cannot transfer stake pool ownership');
    });
  });

});