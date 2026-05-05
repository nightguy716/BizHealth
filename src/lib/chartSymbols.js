function toTvCore(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\.NS$/, '')
    .replace(/\.BO$/, '')
    .replace(/&/g, '_')
    .replace(/\./g, '_');
}

function toTvCoreCompact(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\.NS$/, '')
    .replace(/\.BO$/, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function toTradingViewSymbol(raw, fallbackExchange = 'NYSE') {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return 'NYSE:SLB';
  if (value.includes(':')) {
    const [ex = fallbackExchange, sym = 'SLB'] = value.split(':');
    return `${ex}:${toTvCore(sym)}`;
  }
  if (value.endsWith('.NS')) return `NSE:${toTvCore(value)}`;
  if (value.endsWith('.BO')) return `BSE:${toTvCore(value)}`;
  return `${fallbackExchange}:${toTvCore(value)}`;
}

export function fromCompanyToTradingViewSymbol(company) {
  const ticker = String(company?.ticker || '').trim().toUpperCase();
  const exchange = String(company?.exchange || '').trim().toUpperCase();
  if (!ticker) return 'NYSE:SLB';
  if (exchange === 'NSE') return toTradingViewSymbol(ticker, 'NSE');
  if (exchange === 'BSE') return toTradingViewSymbol(ticker, 'BSE');
  if (exchange === 'NASDAQ') return toTradingViewSymbol(ticker, 'NASDAQ');
  return toTradingViewSymbol(ticker, 'NYSE');
}

export function getTradingViewSymbolCandidates(raw, exchangeHint = 'NYSE') {
  const source = String(raw || '').trim().toUpperCase();
  if (!source) return ['NYSE:SLB'];

  let exchange = exchangeHint;
  let coreSource = source;

  if (source.includes(':')) {
    const [ex = exchangeHint, sym = source] = source.split(':');
    exchange = ex || exchangeHint;
    coreSource = sym || source;
  } else if (source.endsWith('.NS')) {
    exchange = 'NSE';
  } else if (source.endsWith('.BO')) {
    exchange = 'BSE';
  }

  const variants = [
    `${exchange}:${toTvCore(coreSource)}`,
    `${exchange}:${toTvCoreCompact(coreSource)}`,
  ];

  const unique = [];
  for (const v of variants) {
    if (v && !unique.includes(v)) unique.push(v);
  }
  return unique.length ? unique : ['NYSE:SLB'];
}
