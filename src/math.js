const BN = require('bn.js');

const PRECISION = new BN('1000000000');

const math = {}

math.decimalize = (a, decimals) => {
  if (!a) return 0;
  if (decimals <= 0 || decimals % 1 != 0) return 0;
  const n = a.toString();
  const m = n.split('.');
  if (m.length > 2) throw new Error('Invalid number');
  if (m.length == 1) return BigInt(a) * BigInt(10 ** decimals);
  if (m[1].length >= decimals) return BigInt(m[0] + m[1].substring(0, decimals));
  else return BigInt(m[0] + m[1] + '0'.repeat(decimals - m[1].length));
}

math.undecimalize = (a, decimals) => {
  if (!a) return 0;
  if (decimals <= 0 || decimals % 1 != 0) return 0;
  const n = a.toString();
  if (n.length > decimals) return n.substring(0, n.length - decimals) + '.' + n.substring(n.length - decimals, n.length);
  if (n.length == decimals) return '0.' + n;
  else return '0.' + '0'.repeat(decimals - n.length) + n;
}

math.div = (a, b) => {
  if (!a || !b) return 0;
  const ba = new BN(a);
  const bb = new BN(b);
  const bc = ba.mul(PRECISION).div(bb);
  const c = bc.toString();
  if (c.length > 9) return parseFloat(c.substring(0, c.length - 9) + '.' + c.substring(c.length - 9, c.length));
  else return parseFloat('0.' + '0'.repeat(9 - c.length) + c);
}

module.exports = math;