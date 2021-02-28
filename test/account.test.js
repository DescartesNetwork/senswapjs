const { createPrefixedAccount } = require('../dist');

describe('Account library', function () {
  it('Should create a prefixed account', function (done) {
    try {
      const prefix = 'S';
      const newAccount = createPrefixedAccount(prefix);
      console.log(newAccount.publicKey.toBase58());
      return done();
    } catch (er) {
      return done(er);
    }
  });
});