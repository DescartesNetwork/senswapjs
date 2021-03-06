const {
  createPrefixedAccount, fromSecretKey, deriveAssociatedAddress,
  SPLT, sign, verify,
} = require('../dist');

const PAYER = 'e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720';
const MINT_ADDRESS = '6Qvp2kKkZwPoNibncFPygiEJJd6sFP5JeHbtsQDyBqNN';


describe('Account library', function () {
  it('Should create a prefixed account', function (done) {
    const prefix = '';
    createPrefixedAccount(prefix, (addr) => {
    }).then(acc => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  it('Should derive associated address', function (done) {
    const splt = new SPLT();
    const payer = fromSecretKey(PAYER);
    deriveAssociatedAddress(
      payer.publicKey.toBase58(),
      MINT_ADDRESS,
      splt.spltProgramId.toBase58(),
      splt.splataProgramId.toBase58()
    ).then(address => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  it('Should sign/verify', function (done) {
    const { address, sig, data } = sign('🚀', PAYER);
    const ok = verify(address, sig, data);
    if (!ok) return done('Incorrect signature');
    return done();
  });
});