const { SPLT, createAccount, Lamports, RawWallet } = require('../dist');

const primary = new RawWallet('e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720');
const secondary = new RawWallet('2cedf5aba2387360b2e1cbfc649200bbda25f3ca01920c1e97bf81a58b91302180f78b4aeb06b742fd36decdbc60df7dfba2a606ba11de6c987eed1d827572a0');
let MINT_ADDRESS = '';
let SRC_ADDRESS = '';
let DST_ADDRESS = '';
let MULTISIG_ADDRESS = '';


describe('SPLT library', function () {
  it('Mint', async function () {
    const splt = new SPLT();
    const primaryAddress = await primary.getAccount();
    const secondaryAddress = await secondary.getAccount();
    // Initialize mint
    const mint = createAccount();
    MINT_ADDRESS = mint.publicKey.toBase58();
    await splt.initializeMint(9, primaryAddress, null, mint, primary);
    // Initialize source/destination account
    const { accountAddress: srcAddress } = await splt.initializeAccount(MINT_ADDRESS, primaryAddress, primary);
    SRC_ADDRESS = srcAddress;
    const { accountAddress: dstAddress } = await splt.initializeAccount(MINT_ADDRESS, secondaryAddress, primary);
    DST_ADDRESS = dstAddress;
    // Mint token
    await splt.mintTo(5000000000000000000n, MINT_ADDRESS, SRC_ADDRESS, primary);
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
      try { new SPLT('abc') } catch (er) { return }
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
      const primaryAddress = await primary.getAccount();
      await splt.initializeMint(9, primaryAddress, freezeAuthorityAddress, mint, primary);
      await splt.getMintData(mint.publicKey.toBase58());
    });

    it('Should mint', async function () {
      const splt = new SPLT();
      const amount = 10000000000000n;
      await splt.mintTo(amount, MINT_ADDRESS, SRC_ADDRESS, primary);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should burn', async function () {
      const splt = new SPLT();
      const amount = 5000000000000n;
      await splt.burn(amount, SRC_ADDRESS, MINT_ADDRESS, primary);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should not set freeze authority (to mint)', async function () {
      const splt = new SPLT();
      const authorityType = SPLT.AuthorityType.FreezeAccount;
      const newFreezeAuthorityAddress = await primary.getAccount();
      try {
        await splt.setAuthority(authorityType, newFreezeAuthorityAddress, MINT_ADDRESS, primary);
      } catch (er) {
        return;
      }
      throw new Error('An invalid action is skipped');
    });

    it('Should initialize/set/unset authority (to mint)', async function () {
      const splt = new SPLT();
      const mint = createAccount();
      const authorityType = SPLT.AuthorityType.FreezeAccount;
      const mintAddress = mint.publicKey.toBase58();
      const primaryAddress = await primary.getAccount();
      await splt.initializeMint(9, primaryAddress, primaryAddress, mint, primary);
      const newFreezeAuthorityAddress = await secondary.getAccount();
      await splt.setAuthority(authorityType, newFreezeAuthorityAddress, mintAddress, primary);
      await splt.setAuthority(authorityType, null, mintAddress, secondary);
    });
  });

  describe('Test Account', function () {
    it('Should be a valid account data', async function () {
      const splt = new SPLT();
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should initialize/close an account', async function () {
      const lamports = new Lamports();
      const splt = new SPLT();
      const targetAccount = createAccount();
      const targetWallet = new RawWallet(Buffer.from(targetAccount.secretKey).toString('hex'));
      const targetAddress = targetAccount.publicKey.toBase58();
      await lamports.transfer(10000000, targetAddress, primary);
      const { accountAddress } = await splt.initializeAccount(MINT_ADDRESS, targetAddress, targetWallet);
      await splt.getAccountData(accountAddress);
      await splt.closeAccount(accountAddress, targetWallet);
    });

    it('Should transfer (from owner)', async function () {
      const splt = new SPLT();
      const amount = 10000000000n;
      await splt.transfer(amount, SRC_ADDRESS, DST_ADDRESS, primary);
      await splt.getAccountData(SRC_ADDRESS);
      await splt.getAccountData(DST_ADDRESS);
    });

    it('Should approve', async function () {
      const splt = new SPLT();
      const amount = 10000000000n;
      const secondaryAddress = await secondary.getAccount();
      await splt.approve(amount, SRC_ADDRESS, secondaryAddress, primary);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should transfer (from delegate)', async function () {
      const splt = new SPLT();
      const amount = 5000000000n;
      await splt.transfer(amount, SRC_ADDRESS, DST_ADDRESS, secondary);
      await splt.getAccountData(SRC_ADDRESS);
      await splt.getAccountData(DST_ADDRESS);
    });

    it('Should revoke', async function () {
      const splt = new SPLT();
      await splt.revoke(SRC_ADDRESS, primary);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should set authority (to account)', async function () {
      const splt = new SPLT();
      const authorityType = SPLT.AuthorityType.CloseAccount;
      const newAuthorityAddress = await primary.getAccount();
      await splt.setAuthority(authorityType, newAuthorityAddress, SRC_ADDRESS, primary);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should unset authority', async function () {
      const splt = new SPLT();
      const authorityType = SPLT.AuthorityType.CloseAccount;
      await splt.setAuthority(authorityType, null, SRC_ADDRESS, primary);
      await splt.getAccountData(SRC_ADDRESS);
    });

    it('Should freeze/thaw account', async function () {
      const splt = new SPLT();
      const mint = createAccount();
      const mintAddress = mint.publicKey.toBase58();
      const primaryAddress = await primary.getAccount();
      await splt.initializeMint(9, primaryAddress, primaryAddress, mint, primary);
      const { accountAddress } = await splt.initializeAccount(mintAddress, primaryAddress, primary);
      await splt.freezeAccount(accountAddress, mintAddress, primary);
      await splt.thawAccount(accountAddress, mintAddress, primary);
    });

    it('Should wrap/unwrap', async function () {
      const lamports = new Lamports();
      const splt = new SPLT();
      const targetAccount = createAccount();
      const targetWallet = new RawWallet(Buffer.from(targetAccount.secretKey).toString('hex'));
      const targetAddress = targetAccount.publicKey.toBase58();
      await lamports.transfer(15000000, targetAddress, primary);
      const { accountAddress } = await splt.wrap(10 ** 7, targetAddress, targetWallet);
      await splt.getAccountData(accountAddress);
      await splt.unwrap(targetWallet);
    });
  });

  describe('Test MultiSig', function () {
    it('Should initialize MultiSig', async function () {
      const splt = new SPLT();
      const multiSig = createAccount();
      MULTISIG_ADDRESS = multiSig.publicKey.toBase58()
      const signerAddresses = [];
      const primaryAddress = await primary.getAccount();
      signerAddresses.push(primaryAddress);
      const secondaryAddress = await secondary.getAccount();
      signerAddresses.push(secondaryAddress);
      await splt.initializeMultiSig(2, signerAddresses, multiSig, primary);
    });

    it('Should be a valid mint data', async function () {
      const splt = new SPLT();
      await splt.getMultiSigData(MULTISIG_ADDRESS);
    });
  });

});