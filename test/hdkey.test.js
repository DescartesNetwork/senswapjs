const nacl = require('tweetnacl');
const ssjs = require('../dist');

const TOKEN_PROGRAM_ADDRESS = 'JCbHuGZyQiC9abPpEHfs6W8evgumEYthpqqBsgDRewa8';
const TOKEN_ADDRESS = '8FEeLWU2U6LdwoCz1vHFssTMtzQUNwP5cvwP2ohrMYcE';
const SECRETKEY = '2cedf5aba2387360b2e1cbfc649200bbda25f3ca01920c1e97bf81a58b91302180f78b4aeb06b742fd36decdbc60df7dfba2a606ba11de6c987eed1d827572a0';

describe('HD Key library', function () {
  describe('Test keypair', function () {
    it('Should be a valid keypair', function (done) {
      const index = 0;
      const indexAddress = ssjs.toPathAddress(index.toString());
      const path = `m/${TOKEN_PROGRAM_ADDRESS}/${TOKEN_ADDRESS}/${indexAddress}`;
      const newAccount = ssjs.deriveChild(SECRETKEY, path);
      const message = Buffer.from('hello world');
      const signature = nacl.sign.detached(message, newAccount.secretKey);
      const ok = nacl.sign.detached.verify(message, signature, newAccount.publicKey.toBuffer());
      const er = ok ? null : 'Invalid keypair';
      done(er);
    });
  });

});