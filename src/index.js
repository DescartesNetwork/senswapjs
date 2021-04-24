const account = require('./account');
const math = require('./math');
const keystore = require('./keystore');
const hdkey = require('./hdkey');
const util = require('./util');
const schema = require('./schema');
const Swap = require('./swap');
const { SPLT, AuthorityType } = require('./splt');
const Lamports = require('./lamports');
const oracle = require('./oracle');
const crypto = require('./crypto');

module.exports = {
  account, ...account,
  math, ...math,
  keystore, ...keystore,
  hdkey, ...hdkey,
  util, ...util,
  schema, ...schema,
  Swap,
  SPLT,
  AuthorityType,
  Lamports,
  oracle, ...oracle,
  crypto,
}