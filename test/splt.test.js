const {
  SPLT, AuthorityType, createAccount,
  deriveAssociatedAddress, Lamports, RawWallet
} = require('../dist');

const payer = new RawWallet('e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720');
const delegate = new RawWallet('2cedf5aba2387360b2e1cbfc649200bbda25f3ca01920c1e97bf81a58b91302180f78b4aeb06b742fd36decdbc60df7dfba2a606ba11de6c987eed1d827572a0');
let MINT_ADDRESS = '';
let SRC_ADDRESS = '';
let DST_ADDRESS = '';
let MULTISIG_ADDRESS = 'J57UhhZe5xpc3oje11aj8QFjAAZVgg4hWxbpLgJnVxyN';


describe('SPLT library', function () {
  it('Mint', async function () {
    const mint = createAccount();
    const src = createAccount();
    const dst = createAccount();
    MINT_ADDRESS = mint.publicKey.toBase58();
    SRC_ADDRESS = src.publicKey.toBase58();
    DST_ADDRESS = dst.publicKey.toBase58();
    const splt = new SPLT();
    const payerAddress = await payer.getAccount();
    await splt.initializeMint(9, payerAddress, null, mint, payer);
    await splt.initializeAccount(src, MINT_ADDRESS, payer);
    await splt.mintTo(5000000000000000000n, MINT_ADDRESS, SRC_ADDRESS, payer);
    await splt.initializeAccount(dst, MINT_ADDRESS, payer);
  });

  describe('Test constructor', function () {
    it('Should fill configs', async function () {
      // Mint
      console.log('MINT_ADDRESS:', MINT_ADDRESS);
      console.log('SRC_ADDRESS:', SRC_ADDRESS);
      console.log('DST_ADDRESS:', DST_ADDRESS);
      console.log('\n');
    });


    it('Should be a valid default in constructor', async function () {
      new SPLT();
    });

    it('Should be a valid address in constructor', async function () {
      new SPLT('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    });

    it('Should be an invalid address in constructor', async function () {
      try {
        new SPLT('abc');
      } catch (er) {
        return;
      }
      throw new Error('An invalid address is skipped');
    });
  });

  describe('Test Mint', function () {
    it('Should be a valid mint data', async function () {
      const splt = new SPLT();
      await splt.getMintData(MINT_ADDRESS);
    });

    it('Should initialize Mint', async function () {
      const splt = new SPLT();
      const mint = createAccount();
      const freezeAuthorityAddress = null; // Unset freeze authority
      const payerAddress = await payer.getAccount();
      await splt.initializeMint(9, payerAddress, freezeAuthorityAddress, mint, payer);
      await splt.getMintData(mint.publicKey.toBase58());
    });

    it('Should mint', async function () {
      const splt = new SPLT();
      const amount = 10000000000000n;
      await splt.mintTo(amount, MINT_ADDRESS, SRC_ADDRESS, payer);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should burn', async function () {
      const splt = new SPLT();
      const amount = 5000000000000n;
      await splt.burn(amount, SRC_ADDRESS, MINT_ADDRESS, payer);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should not set authority (to mint)', async function () {
      const splt = new SPLT();
      const authorityType = AuthorityType.FreezeAccount;
      const newFreezeAuthorityAddress = await payer.getAccount();
      try {
        await splt.setAuthority(authorityType, newFreezeAuthorityAddress, MINT_ADDRESS, payer);
      } catch (er) {
        return;
      }
      throw new Error('An invalid action is skipped');
    });

    it('Should initialize/set/unset authority (to mint)', async function () {
      const splt = new SPLT();
      const mint = createAccount();
      const authorityType = AuthorityType.FreezeAccount;
      const mintAddress = mint.publicKey.toBase58();
      const payerAddress = await payer.getAccount();
      await splt.initializeMint(9, payerAddress, payerAddress, mint, payer);
      const newFreezeAuthorityAddress = await delegate.getAccount();
      await splt.setAuthority(authorityType, newFreezeAuthorityAddress, mintAddress, payer);
      await splt.setAuthority(authorityType, null, mintAddress, delegate);
    });
  });

  describe('Test Account', function () {
    it('Should be a valid account data', async function () {
      const splt = new SPLT();
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should initialize/close Account (associated)', async function () {
      const lamports = new Lamports();
      const splt = new SPLT();
      const targetAccount = createAccount();
      const targetWallet = new RawWallet(Buffer.from(targetAccount.secretKey).toString('hex'));
      await lamports.transfer(10000000, targetAccount.publicKey.toBase58(), payer);
      const newAddress = await deriveAssociatedAddress(
        targetAccount.publicKey.toBase58(),
        MINT_ADDRESS,
        splt.spltProgramId.toBase58(),
        splt.splataProgramId.toBase58()
      );
      await splt.initializeAccount(newAddress, MINT_ADDRESS, targetWallet);
      await splt.getAccountData(newAddress);
      await splt.closeAccount(newAddress, targetWallet);
    });

    it('Should initialize/close Account (arbitrary)', async function () {
      const splt = new SPLT();
      const newAccount = createAccount();
      await splt.initializeAccount(newAccount, MINT_ADDRESS, payer);
      await splt.getAccountData(newAccount.publicKey.toBase58());
      await splt.closeAccount(newAccount.publicKey.toBase58(), payer);
    });

    it('Should transfer (from owner)', async function () {
      const splt = new SPLT();
      const amount = 10000000000n;
      await splt.transfer(amount, SRC_ADDRESS, DST_ADDRESS, payer);
      await splt.getAccountData(SRC_ADDRESS);
      await splt.getAccountData(DST_ADDRESS);
    });

    it('Should approve', async function () {
      const splt = new SPLT();
      const amount = 10000000000n;
      const delegateAddress = await delegate.getAccount();
      await splt.approve(amount, SRC_ADDRESS, delegateAddress, payer);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should transfer (from delegate)', async function () {
      const splt = new SPLT();
      const amount = 5000000000n;
      await splt.transfer(amount, SRC_ADDRESS, DST_ADDRESS, delegate);
      await splt.getAccountData(SRC_ADDRESS);
      await splt.getAccountData(DST_ADDRESS);
    });

    it('Should revoke', async function () {
      const splt = new SPLT();
      await splt.revoke(SRC_ADDRESS, payer);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should set authority (to account)', async function () {
      const splt = new SPLT();
      const authorityType = AuthorityType.CloseAccount;
      const newAuthorityAddress = await payer.getAccount();
      await splt.setAuthority(authorityType, newAuthorityAddress, SRC_ADDRESS, payer);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should unset authority', async function () {
      const splt = new SPLT();
      const authorityType = AuthorityType.CloseAccount;
      await splt.setAuthority(authorityType, null, SRC_ADDRESS, payer);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should freeze/thaw account', async function () {
      const splt = new SPLT();
      const newAccount = createAccount();
      const mint = createAccount();
      const accountAddress = newAccount.publicKey.toBase58();
      const mintAddress = mint.publicKey.toBase58();
      const payerAddress = await payer.getAccount();
      await splt.initializeMint(9, payerAddress, payerAddress, mint, payer);
      await splt.initializeAccount(newAccount, mintAddress, payer);
      await splt.freezeAccount(accountAddress, mintAddress, payer);
      await splt.thawAccount(accountAddress, mintAddress, payer);
    });
  });

  describe('Test MultiSig', function () {
    it('Should be a valid mint data', async function () {
      const splt = new SPLT();
      await splt.getMultiSigData(MULTISIG_ADDRESS);
    });

    it('Should initialize MultiSig', async function () {
      const splt = new SPLT();
      const multiSig = createAccount();
      const signerAddresses = [];
      const payerAddress = await payer.getAccount();
      signerAddresses.push(payerAddress);
      const delegateAddress = await delegate.getAccount();
      signerAddresses.push(delegateAddress);
      await splt.initializeMultiSig(2, signerAddresses, multiSig, payer);
      await splt.getMultiSigData(multiSig.publicKey.toBase58());
    });
  });

});