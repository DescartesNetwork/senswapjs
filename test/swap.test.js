const {
  createAccount, createStrictAccount, deriveAssociatedAddress,
  Swap, SPLT
} = require('../dist');
const Wallet = require('./wallet.mock');

const payer = new Wallet('e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720');
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
    splt.initializeMint(9, null, mint, payer).then(txId => {
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
    splt.initializeMint(9, null, mint, payer).then(txId => {
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
    splt.initializeMint(9, null, mint, payer).then(txId => {
      return splt.initializeAccount(account, MINT_ADDRESS_2, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS_2, ACCOUNT_ADDRESS_2, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  it('Pool', function (done) {
    const swap = new Swap();
    const mintLPT = createAccount();
    const vault = createAccount();
    const treasuryS = createAccount();
    const treasuryA = createAccount();
    const treasuryB = createAccount();
    MINT_LPT_ADDRESS_0 = mintLPT.publicKey.toBase58();
    VAULT_ADDRESS_0 = vault.publicKey.toBase58();
    TREASURY_S_ADDRESS_0 = treasuryS.publicKey.toBase58();
    TREASURY_A_ADDRESS_0 = treasuryA.publicKey.toBase58();
    TREASURY_B_ADDRESS_0 = treasuryB.publicKey.toBase58();

    payer.getAccount().then(payerAddress => {
      return deriveAssociatedAddress(
        payerAddress,
        MINT_LPT_ADDRESS_0,
        swap.spltProgramId.toBase58(),
        swap.splataProgramId.toBase58(),
      );
    }).then(lptAddress => {
      LPT_ADDRESS_0 = lptAddress;
      return createStrictAccount(swap.swapProgramId);
    }).then(pool => {
      POOL_ADDRESS_0 = pool.publicKey.toBase58();
      return swap.initializePool(
        1000000000000n, 5000000000000n, 200000000000n,
        pool, LPT_ADDRESS_0, mintLPT, vault,
        ACCOUNT_ADDRESS_0, MINT_ADDRESS_0, treasuryS,
        ACCOUNT_ADDRESS_1, MINT_ADDRESS_1, treasuryA,
        ACCOUNT_ADDRESS_2, MINT_ADDRESS_2, treasuryB,
        payer
      );
    }).then(txId => {
      console.log(txId);
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  // it('Pool 1', function (done) {
  //   const swap = new Swap();
  //   const treasuryS = createAccount();
  //   const treasuryA = createAccount();
  //   const treasuryB = createAccount();
  //   const lpt = createAccount();
  //   const vault = createAccount();
  //   TREASURY_S_ADDRESS_1 = treasuryS.publicKey.toBase58();
  //   TREASURY_A_ADDRESS_1 = treasuryA.publicKey.toBase58();
  //   TREASURY_B_ADDRESS_1 = treasuryB.publicKey.toBase58();
  //   LPT_ADDRESS_1 = lpt.publicKey.toBase58();
  //   VAULT_ADDRESS_1 = vault.publicKey.toBase58();
  //   createStrictAccount(swap.swapProgramId).then(pool => {
  //     POOL_ADDRESS_1 = pool.publicKey.toBase58();
  //     return swap.initializePool(
  //       1000000000000n, 5000000000000n, 200000000000n,
  //       pool, lpt,
  //       ACCOUNT_ADDRESS_0, MINT_ADDRESS_0, treasuryS,
  //       ACCOUNT_ADDRESS_1, MINT_ADDRESS_1, treasuryA,
  //       ACCOUNT_ADDRESS_2, MINT_ADDRESS_2, treasuryB,
  //       vault,
  //       payer
  //     );
  //   }).then(txId => {
  //     return done();
  //   }).catch(er => {
  //     return done(er);
  //   });
  // });

  // describe('Test constructor', function () {
  //   it('Should fill configs', function (done) {
  //     // Mint 0
  //     console.log('MINT_ADDRESS_0:', MINT_ADDRESS_0);
  //     console.log('ACCOUNT_ADDRESS_0:', ACCOUNT_ADDRESS_0);
  //     console.log('\n');
  //     // Mint 1
  //     console.log('MINT_ADDRESS_1:', MINT_ADDRESS_1);
  //     console.log('ACCOUNT_ADDRESS_1:', ACCOUNT_ADDRESS_1);
  //     console.log('\n');
  //     // Mint 2
  //     console.log('MINT_ADDRESS_2:', MINT_ADDRESS_2);
  //     console.log('ACCOUNT_ADDRESS_2:', ACCOUNT_ADDRESS_2);
  //     console.log('\n');
  //     // Pool 0
  //     console.log('POOL_ADDRESS_0:', POOL_ADDRESS_0);
  //     console.log('TREASURY_S_ADDRESS_0:', TREASURY_S_ADDRESS_0);
  //     console.log('TREASURY_A_ADDRESS_0:', TREASURY_A_ADDRESS_0);
  //     console.log('TREASURY_B_ADDRESS_0:', TREASURY_B_ADDRESS_0);
  //     console.log('LPT_ADDRESS_0:', LPT_ADDRESS_0);
  //     console.log('VAULT_ADDRESS_0:', VAULT_ADDRESS_0);
  //     console.log('\n');
  //     // Pool 1
  //     console.log('POOL_ADDRESS_1:', POOL_ADDRESS_1);
  //     console.log('TREASURY_S_ADDRESS_1:', TREASURY_S_ADDRESS_1);
  //     console.log('TREASURY_A_ADDRESS_1:', TREASURY_A_ADDRESS_1);
  //     console.log('TREASURY_B_ADDRESS_1:', TREASURY_B_ADDRESS_1);
  //     console.log('LPT_ADDRESS_1:', LPT_ADDRESS_1);
  //     console.log('VAULT_ADDRESS_1:', VAULT_ADDRESS_1);
  //     console.log('\n');

  //     return done();
  //   });

  //   it('Should be a valid default in constructor', function (done) {
  //     try {
  //       const swap = new Swap();
  //       return done();
  //     } catch (er) {
  //       return done(er);
  //     }
  //   });

  //   it('Should be a valid address in constructor', function (done) {
  //     try {
  //       const swap = new Swap('F5SvYWVLivzKc8XjoKaKxeXe2Yo8YZbJtbPbvq3b2sGj');
  //       return done();
  //     } catch (er) {
  //       return done(er);
  //     }
  //   });

  //   it('Should be an invalid address in constructor', function (done) {
  //     try {
  //       const swap = new Swap('abc');
  //       return done('An invalid address is skipped');
  //     } catch (er) {
  //       return done();
  //     }
  //   });
  // });

  // describe('Test Pool', function () {
  //   it('Should be a valid pool data', function (done) {
  //     const swap = new Swap();
  //     swap.getPoolData(POOL_ADDRESS_0).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should not initialize pool', function (done) {
  //     const swap = new Swap();
  //     const treasuryS = createAccount();
  //     const treasuryA = createAccount();
  //     const treasuryB = createAccount();
  //     const lpt = createAccount();
  //     const vault = createAccount();
  //     createStrictAccount(swap.swapProgramId).then(pool => {
  //       return swap.initializePool(
  //         0n, 50000000000n, 50000000000n,
  //         pool, lpt,
  //         ACCOUNT_ADDRESS_0, MINT_ADDRESS_0, treasuryS,
  //         ACCOUNT_ADDRESS_1, MINT_ADDRESS_1, treasuryA,
  //         ACCOUNT_ADDRESS_2, MINT_ADDRESS_2, treasuryB,
  //         vault,
  //         payer
  //       );
  //     }).then(data => {
  //       return done('The reserve should be not zero');
  //     }).catch(er => {
  //       return done();
  //     });
  //   });

  //   it('Should initialize pool and receive lpt', function (done) {
  //     const swap = new Swap();
  //     const treasuryS = createAccount();
  //     const treasuryA = createAccount();
  //     const treasuryB = createAccount();
  //     const lpt = createAccount();
  //     const vault = createAccount();
  //     createStrictAccount(swap.swapProgramId).then(pool => {
  //       return swap.initializePool(
  //         1000000000000n, 50000000000n, 50000000000n,
  //         pool, lpt,
  //         ACCOUNT_ADDRESS_0, MINT_ADDRESS_0, treasuryS,
  //         ACCOUNT_ADDRESS_1, MINT_ADDRESS_1, treasuryA,
  //         ACCOUNT_ADDRESS_2, MINT_ADDRESS_2, treasuryB,
  //         vault,
  //         payer
  //       );
  //     }).then(txId => {
  //       return swap.getLPTData(lpt.publicKey.toBase58());
  //     }).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should swap', function (done) {
  //     const swap = new Swap();
  //     swap.getPoolData(POOL_ADDRESS_0).then(data => {
  //       return swap.swap(
  //         10000000000n,
  //         POOL_ADDRESS_0, VAULT_ADDRESS_0,
  //         ACCOUNT_ADDRESS_1, TREASURY_A_ADDRESS_0,
  //         ACCOUNT_ADDRESS_2, TREASURY_B_ADDRESS_0,
  //         TREASURY_S_ADDRESS_0,
  //         payer
  //       );
  //     }).then(txId => {
  //       return swap._getAccountData(VAULT_ADDRESS_0);
  //     }).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     })
  //   });
  // });

  // describe('Test LPT', function () {
  //   it('Should be a valid lpt data', function (done) {
  //     const swap = new Swap();
  //     swap.getLPTData(LPT_ADDRESS_0).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should add liquidity', function (done) {
  //     const swap = new Swap();
  //     const lpt = createAccount();
  //     const lptAddress = lpt.publicKey.toBase58();
  //     swap.initializeLPT(lpt, POOL_ADDRESS_0, payer).then(txId => {
  //       return swap.getLPTData(lptAddress);
  //     }).then(data => {
  //       return swap.addLiquidity(
  //         100000000000n, 100000000000n, 100000000000n,
  //         POOL_ADDRESS_0, lptAddress,
  //         ACCOUNT_ADDRESS_0, TREASURY_S_ADDRESS_0,
  //         ACCOUNT_ADDRESS_1, TREASURY_A_ADDRESS_0,
  //         ACCOUNT_ADDRESS_2, TREASURY_B_ADDRESS_0,
  //         payer
  //       );
  //     }).then(txId => {
  //       return swap.getLPTData(lptAddress);
  //     }).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should remove liquidity', function (done) {
  //     const swap = new Swap();
  //     swap.getLPTData(LPT_ADDRESS_0).then(data => {
  //       return swap.removeLiquidity(
  //         5000000000n,
  //         POOL_ADDRESS_0, LPT_ADDRESS_0,
  //         ACCOUNT_ADDRESS_0, TREASURY_S_ADDRESS_0,
  //         ACCOUNT_ADDRESS_1, TREASURY_A_ADDRESS_0,
  //         ACCOUNT_ADDRESS_2, TREASURY_B_ADDRESS_0,
  //         payer
  //       )
  //     }).then(txId => {
  //       return swap.getLPTData(LPT_ADDRESS_0);
  //     }).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should transfer', function (done) {
  //     const swap = new Swap();
  //     const lpt = createAccount();
  //     const lptAddress = lpt.publicKey.toBase58();
  //     swap.initializeLPT(lpt, POOL_ADDRESS_0, payer).then(txId => {
  //       return swap.getLPTData(lptAddress);
  //     }).then(data => {
  //       return swap.transfer(1000000000n, LPT_ADDRESS_0, lptAddress, payer);
  //     }).then(txId => {
  //       return swap.getLPTData(lptAddress);
  //     }).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should transfer lpt ownership', function (done) {
  //     const swap = new Swap();
  //     const newOwnerAddress = createAccount().publicKey.toBase58();
  //     swap.transferLPTOwnership(LPT_ADDRESS_1, newOwnerAddress, payer).then(txId => {
  //       return swap.getLPTData(LPT_ADDRESS_1);
  //     }).then(data => {
  //       if (data.owner == newOwnerAddress) return done();
  //       return done('Cannot transfer lpt ownership');
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should close LPT & Pool', function (done) {
  //     const swap = new Swap();
  //     const lpt = createAccount();
  //     const treasuryS = createAccount();
  //     const treasuryA = createAccount();
  //     const treasuryB = createAccount();
  //     const vault = createAccount();

  //     let poolAddress = '';
  //     const lptAddress = lpt.publicKey.toBase58();
  //     const treasurySAddress = treasuryS.publicKey.toBase58();
  //     const treasuryAAddress = treasuryA.publicKey.toBase58();
  //     const treasuryBAddress = treasuryB.publicKey.toBase58();
  //     const vaultAddress = vault.publicKey.toBase58();
  //     let dstAddress = null;

  //     payer.getAccount().then(re => {
  //       dstAddress = re;
  //       return createStrictAccount(swap.swapProgramId)
  //     }).then(pool => {
  //       poolAddress = pool.publicKey.toBase58();
  //       return swap.initializePool(
  //         1000000000000n, 50000000000n, 50000000000n,
  //         pool, lpt,
  //         ACCOUNT_ADDRESS_0, MINT_ADDRESS_0, treasuryS,
  //         ACCOUNT_ADDRESS_1, MINT_ADDRESS_1, treasuryA,
  //         ACCOUNT_ADDRESS_2, MINT_ADDRESS_2, treasuryB,
  //         vault,
  //         payer
  //       );
  //     }).then(txId => {
  //       return swap.removeLiquidity(
  //         1000000000000n,
  //         poolAddress, lptAddress,
  //         ACCOUNT_ADDRESS_0, treasurySAddress,
  //         ACCOUNT_ADDRESS_1, treasuryAAddress,
  //         ACCOUNT_ADDRESS_2, treasuryBAddress,
  //         payer
  //       );
  //     }).then(txId => {
  //       return swap.closeLPT(lptAddress, dstAddress, payer);
  //     }).then(txId => {
  //       return swap.closePool(
  //         poolAddress,
  //         treasurySAddress, treasuryAAddress, treasuryBAddress,
  //         dstAddress,
  //         vaultAddress,
  //         payer
  //       );
  //     }).then(txId => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });
  // });

  // describe('Test pool owner', function () {

  //   it('Should freeze/thaw pool', function (done) {
  //     const swap = new Swap();
  //     swap.freezePool(POOL_ADDRESS_0, payer).then(txId => {
  //       return swap.thawPool(POOL_ADDRESS_0, payer);
  //     }).then(txId => {
  //       return swap.getPoolData(POOL_ADDRESS_0);
  //     }).then(data => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should earn', function (done) {
  //     const swap = new Swap();
  //     const amount = 1000n;
  //     swap.earn(amount, POOL_ADDRESS_0, VAULT_ADDRESS_0, ACCOUNT_ADDRESS_0, payer).then(txId => {
  //       return done();
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });

  //   it('Should transfer pool ownership', function (done) {
  //     const swap = new Swap();
  //     const newOwnerAddress = createAccount().publicKey.toBase58();
  //     swap.transferPoolOwnership(POOL_ADDRESS_1, newOwnerAddress, payer).then(txId => {
  //       return swap.getPoolData(POOL_ADDRESS_1);
  //     }).then(data => {
  //       if (data.owner == newOwnerAddress) return done();
  //       return done('Cannot transfer pool ownership');
  //     }).catch(er => {
  //       return done(er);
  //     });
  //   });
  // });

});