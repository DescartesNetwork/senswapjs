const math = {}

math.div = (a, b) => {
  if (!a) return 0;
  if (!b) throw new Error('Divided by zero');
  let integer = Number(a / b);
  let fraction = 0n;
  for (let i = 0; i < 9; i++) {
    a = (a % b) * 10n;
    fraction = fraction * 10n + a / b;
  }
  fraction = Number(fraction) / (10 ** 9);
  return integer + fraction;
}

module.exports = math;