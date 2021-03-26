const { crypto } = require('../dist');

describe('Crypto library', function () {
  it('Should hash', function (done) {
    const str = '123';
    const hash = crypto.hash(str);
    if (hash != '64e604787cbf194841e7b68d7cd28786f6c9a0a3ab9f8b0a0e87cb4387ab0107') return done('Incorrect hash');
    return done();
  });

  it('Should encrypt', function (done) {
    const plain = '123';
    const key = crypto.hash(plain);
    const cypher = crypto.encrypt(key, plain);
    if (cypher != 'd50d08') return done('Incorrect encryption');
    return done();
  });

  it('Should decrypt', function (done) {
    const cypher = 'd50d08';
    const key = crypto.hash('123');
    const plain = crypto.decrypt(key, cypher);
    if (plain != '123') return done('Incorrect decryption');
    return done();
  });
});