const schema = {}

schema.ACCOUNT_SCHEMA = [
  { key: 'owner', type: 'pub' },
  { key: 'token', type: 'pub' },
  { key: 'amount', type: 'u64' },
  { key: 'initialized', type: 'bool' }
];

schema.TOKEN_SCHEMA = [
  { key: 'symbol', type: '[char;4]' },
  { key: 'total_supply', type: 'u64' },
  { key: 'decimals', type: 'u8' },
  { key: 'initialized', type: 'bool' }
];

schema.POOL_SCHEMA = [
  { key: 'token', type: 'pub' },
  { key: 'treasury', type: 'pub' },
  { key: 'reserve', type: 'u64' },
  { key: 'lpt', type: 'u64' },
  { key: 'fee_numerator', type: 'u64' },
  { key: 'fee_denominator', type: 'u64' },
  { key: 'initialized', type: 'bool' }
];

schema.LPT_SCHEMA = [
  { key: 'owner', type: 'pub' },
  { key: 'pool', type: 'pub' },
  { key: 'lpt', type: 'u64' },
  { key: 'initialized', type: 'bool' }
];

schema.SPL = [
  { key: "mint", type: "pub" },
  { key: "owner", type: "pub" },
  { key: "amount", type: "u64" },
  { key: "delegate_option", type: "u32" },
  { key: "delegate", type: "pub" },
  { key: "state", type: "u8" },
  { key: "is_native_option", type: "u32" },
  { key: "is_native", type: "u64" },
  { key: "delegated_amount", type: "u64" },
  { key: "close_authority_option", type: "u32" },
  { key: "close_authority", type: "pub" }
]

module.exports = schema;