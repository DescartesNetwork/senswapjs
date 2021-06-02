const { PublicKey } = require('@solana/web3.js');
const {
  createAccount, createStrictAccount, deriveAssociatedAddress,
  Swap, SPLT, RawWallet
} = require('../dist');

const payer = new RawWallet('e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720');
// Primary Mint
let MINT_ADDRESS_0 = '';
let ACCOUNT_ADDRESS_0 = '';
// Mint 1
let MINT_ADDRESS_1 = '';
let ACCOUNT_ADDRESS_1 = '';
// Mint 2
let MINT_ADDRESS_2 = '';
let ACCOUNT_ADDRESS_2 = '';
// Pool 0
let POOL_ADDRESS_0 = '';
let LPT_ADDRESS_0 = '';
let MINT_LPT_ADDRESS_0 = '';
let VAULT_ADDRESS_0 = '';
let TREASURY_S_ADDRESS_0 = '';
let TREASURY_A_ADDRESS_0 = '';
let TREASURY_B_ADDRESS_0 = '';
// Pool 1
let POOL_ADDRESS_1 = '';
let LPT_ADDRESS_1 = '';
let MINT_LPT_ADDRESS_1 = '';
let VAULT_ADDRESS_1 = '';
let TREASURY_S_ADDRESS_1 = '';
let TREASURY_A_ADDRESS_1 = '';
let TREASURY_B_ADDRESS_1 = '';

describe('Swap library', function () {
  it('Mint 0', function (done) {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_0 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_0 = account.publicKey.toBase58();
    const splt = new SPLT();
    payer.getAccount().then(payerAddress => {
      return splt.initializeMint(9, payerAddress, null, mint, payer);
    }).then(txId => {
      return splt.initializeAccount(account, MINT_ADDRESS_0, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS_0, ACCOUNT_ADDRESS_0, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  it('Mint 1', function (done) {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_1 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_1 = account.publicKey.toBase58();
    const splt = new SPLT();
    payer.getAccount().then(payerAddress => {
      return splt.initializeMint(9, payerAddress, null, mint, payer);
    }).then(txId => {
      return splt.initializeAccount(account, MINT_ADDRESS_1, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS_1, ACCOUNT_ADDRESS_1, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  it('Mint 2', function (done) {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_2 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_2 = account.publicKey.toBase58();
    const splt = new SPLT();
    payer.getAccount().then(payerAddress => {
      return splt.initializeMint(9, payerAddress, null, mint, payer);
    }).then(txId => {
      return splt.initializeAccount(account, MINT_ADDRESS_2, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS_2, ACCOUNT_ADDRESS_2, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  it('Pool 0', async function () {
    const swap = new Swap();
    const mintLPT = createAccount();
    const vault = createAccount();
    const pool = await createStrictAccount(swap.swapProgramId);
    const payerAddress = await payer.getAccount();
    const seed = [pool.publicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, swap.swapProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();

    POOL_ADDRESS_0 = pool.publicKey.toBase58();
    MINT_LPT_ADDRESS_0 = mintLPT.publicKey.toBase58();
    VAULT_ADDRESS_0 = vault.publicKey.toBase58();
    TREASURY_S_ADDRESS_0 = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_0,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    TREASURY_A_ADDRESS_0 = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_1,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    TREASURY_B_ADDRESS_0 = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_2,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    LPT_ADDRESS_0 = await deriveAssociatedAddress(
      payerAddress,
      MINT_LPT_ADDRESS_0,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );

    await swap.initializePool(
      1000000000000n, 5000000000000n, 200000000000n,
      payerAddress, pool, LPT_ADDRESS_0, mintLPT, vault,
      ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
      ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
      ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
      payer
    );
  });

  it('Pool 1', async function () {
    const swap = new Swap();
    const mintLPT = createAccount();
    const vault = createAccount();
    const pool = await createStrictAccount(swap.swapProgramId);
    const payerAddress = await payer.getAccount();
    const seed = [pool.publicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, swap.swapProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();

    POOL_ADDRESS_1 = pool.publicKey.toBase58();
    MINT_LPT_ADDRESS_1 = mintLPT.publicKey.toBase58();
    VAULT_ADDRESS_1 = vault.publicKey.toBase58();
    TREASURY_S_ADDRESS_1 = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_0,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    TREASURY_A_ADDRESS_1 = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_1,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    TREASURY_B_ADDRESS_1 = await deriveAssociatedAddress(
      treasurerAddress,
      MINT_ADDRESS_2,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    LPT_ADDRESS_1 = await deriveAssociatedAddress(
      payerAddress,
      MINT_LPT_ADDRESS_1,
      swap.spltProgramId.toBase58(),
      swap.splataProgramId.toBase58(),
    );
    await swap.initializePool(
      1000000000000n, 5000000000000n, 200000000000n,
      payerAddress, pool, LPT_ADDRESS_1, mintLPT, vault,
      ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
      ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
      ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
      payer
    );
  });

  describe('Test constructor', function () {
    it('Should fill configs', async function () {
      // Payer
      const payerAddress = await payer.getAccount();
      console.log('PAYER:', payerAddress);
      // Mint 0
      console.log('MINT_ADDRESS_0:', MINT_ADDRESS_0);
      console.log('ACCOUNT_ADDRESS_0:', ACCOUNT_ADDRESS_0);
      console.log('\n');
      // Mint 1
      console.log('MINT_ADDRESS_1:', MINT_ADDRESS_1);
      console.log('ACCOUNT_ADDRESS_1:', ACCOUNT_ADDRESS_1);
      console.log('\n');
      // Mint 2
      console.log('MINT_ADDRESS_2:', MINT_ADDRESS_2);
      console.log('ACCOUNT_ADDRESS_2:', ACCOUNT_ADDRESS_2);
      console.log('\n');
      // Pool 0
      console.log('POOL_ADDRESS_0:', POOL_ADDRESS_0);
      console.log('LPT_ADDRESS_0:', LPT_ADDRESS_0);
      console.log('MINT_LPT_ADDRESS_0:', MINT_LPT_ADDRESS_0);
      console.log('VAULT_ADDRESS_0:', VAULT_ADDRESS_0);
      console.log('TREASURY_S_ADDRESS_0:', TREASURY_S_ADDRESS_0);
      console.log('TREASURY_A_ADDRESS_0:', TREASURY_A_ADDRESS_0);
      console.log('TREASURY_B_ADDRESS_0:', TREASURY_B_ADDRESS_0);
      console.log('\n');
      // Pool 1
      console.log('POOL_ADDRESS_1:', POOL_ADDRESS_1);
      console.log('LPT_ADDRESS_1:', LPT_ADDRESS_1);
      console.log('MINT_LPT_ADDRESS_1:', MINT_LPT_ADDRESS_1);
      console.log('VAULT_ADDRESS_1:', VAULT_ADDRESS_1);
      console.log('TREASURY_S_ADDRESS_1:', TREASURY_S_ADDRESS_1);
      console.log('TREASURY_A_ADDRESS_1:', TREASURY_A_ADDRESS_1);
      console.log('TREASURY_B_ADDRESS_1:', TREASURY_B_ADDRESS_1);
      console.log('\n');
    });

    it('Should be a valid default in constructor', function () {
      new Swap();
    });

    it('Should be a valid address in constructor', function () {
      new Swap('F5SvYWVLivzKc8XjoKaKxeXe2Yo8YZbJtbPbvq3b2sGj');
    });

    it('Should be an invalid address in constructor', function () {
      try {
        new Swap('abc');
        throw new Error('No error');
      } catch (er) {
        if (er.message === 'No error') throw new Error('An invalid address is skipped');
      }
    });
  });

  describe('Test Pool', function () {
    it('Should be a valid pool data', async function () {
      const swap = new Swap();
      await swap.getPoolData(POOL_ADDRESS_0);
    });

    it('Should not initialize pool', async function () {
      const swap = new Swap();
      const mintLPT = createAccount();
      const vault = createAccount();
      const pool = await createStrictAccount(swap.swapProgramId);
      const payerAddress = await payer.getAccount();
      const lptAddress = createAccount().publicKey.toBase58();
      try {
        await swap.initializePool(
          0n, 50000000000n, 50000000000n,
          payerAddress, pool, lptAddress, mintLPT, vault,
          ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
          ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
          ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
          payer
        );
        throw new Error('No error');
      } catch (er) {
        if (er.message == 'No error') throw new Error('The reserve should be not zero');
      }
    });

    it('Should be a successful swap', async function () {
      const swap = new Swap();
      await swap.getPoolData(POOL_ADDRESS_0);
      await swap.swap(
        10000000000n, 0n,
        POOL_ADDRESS_0, VAULT_ADDRESS_0,
        ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
        ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
        TREASURY_S_ADDRESS_0,
        payer
      );
      await swap._splt.getAccountData(VAULT_ADDRESS_0);
    });

    it('Should be a failed swap (exceed limit)', async function () {
      const swap = new Swap();
      await swap.getPoolData(POOL_ADDRESS_0);
      try {
        await swap.swap(
          10000000000n, 1000000000n,
          POOL_ADDRESS_0, VAULT_ADDRESS_0,
          ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
          ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
          TREASURY_S_ADDRESS_0,
          payer
        );
        throw new Error('No error');
      } catch (er) {
        if (er.message === 'No error') throw new Error('Swap bypass the limit');
      }
    });
  });

  describe('Test LPT', function () {
    it('Should be a valid lpt data', async function () {
      const swap = new Swap();
      await swap.getLPTData(LPT_ADDRESS_0);
    });

    it('Should add liquidity', async function () {
      const swap = new Swap();
      const lpt = createAccount();
      const lptAddress = lpt.publicKey.toBase58();
      await swap.initializeLPT(lpt, MINT_LPT_ADDRESS_0, payer);
      await swap.getLPTData(lptAddress);
      await swap.addLiquidity(
        100000000000n, 100000000000n, 100000000000n,
        POOL_ADDRESS_0, lptAddress, MINT_LPT_ADDRESS_0,
        ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
        ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
        ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
        payer
      );
      await swap.getLPTData(lptAddress);
    });

    it('Should remove liquidity', async function () {
      const swap = new Swap();
      await swap.getLPTData(LPT_ADDRESS_0);
      await swap.removeLiquidity(
        5000000000n,
        POOL_ADDRESS_0, LPT_ADDRESS_0, MINT_LPT_ADDRESS_0,
        ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
        ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
        ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
        payer
      );
      await swap.getLPTData(LPT_ADDRESS_0);
    });

    it('Should transfer', async function () {
      const swap = new Swap();
      const lpt = createAccount();
      const lptAddress = lpt.publicKey.toBase58();
      await swap.initializeLPT(lpt, MINT_LPT_ADDRESS_0, payer);
      await swap.getLPTData(lptAddress);
      await swap.transfer(1000000000n, LPT_ADDRESS_0, lptAddress, payer);
      await swap.getLPTData(lptAddress);
    });

    it('Should close LPT Account', async function () {
      const swap = new Swap();
      const mintLPT = createAccount();
      const vault = createAccount();
      const pool = await createStrictAccount(swap.swapProgramId);
      const payerAddress = await payer.getAccount();

      const poolAddress = pool.publicKey.toBase58();
      const mintLPTAddress = mintLPT.publicKey.toBase58();
      const lptAddress = await deriveAssociatedAddress(
        payerAddress,
        mintLPTAddress,
        swap.spltProgramId.toBase58(),
        swap.splataProgramId.toBase58(),
      );

      await swap.initializePool(
        1000000000000n, 50000000000n, 50000000000n,
        payerAddress, pool, lptAddress, mintLPT, vault,
        ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
        ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
        ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
        payer
      );
      await swap.removeLiquidity(
        1000000000000n,
        poolAddress, lptAddress, mintLPTAddress,
        ACCOUNT_ADDRESS_0, MINT_ADDRESS_0,
        ACCOUNT_ADDRESS_1, MINT_ADDRESS_1,
        ACCOUNT_ADDRESS_2, MINT_ADDRESS_2,
        payer
      );
      await swap.closeLPT(lptAddress, payer);
    });
  });

  describe('Test pool owner', function () {

    it('Should freeze/thaw pool', async function () {
      const swap = new Swap();
      await swap.freezePool(POOL_ADDRESS_0, payer);
      await swap.thawPool(POOL_ADDRESS_0, payer);
      await swap.getPoolData(POOL_ADDRESS_0);
    });

    it('Should earn', async function () {
      const swap = new Swap();
      const amount = 1000n;
      await swap.earn(amount, POOL_ADDRESS_0, VAULT_ADDRESS_0, ACCOUNT_ADDRESS_0, payer);
    });

    it('Should transfer pool ownership', async function () {
      const swap = new Swap();
      const newOwnerAddress = createAccount().publicKey.toBase58();
      await swap.transferPoolOwnership(POOL_ADDRESS_1, newOwnerAddress, payer);
      const data = await swap.getPoolData(POOL_ADDRESS_1);
      if (data.owner != newOwnerAddress) throw new Error('Cannot transfer pool ownership');
    });
  });

});