const account = require('./account');
const math = require('./math');
const keystore = require('./keystore');
const hdkey = require('./hdkey');
const util = require('./util');
const schema = require('./schema');
const Swap = require('./swap');
const SRC20 = require('./src20');

module.exports = {
  account, ...account,
  math, ...math,
  keystore, ...keystore,
  hdkey, ...hdkey,
  util, ...util,
  schema, ...schema,
  Swap,
  SRC20,
}