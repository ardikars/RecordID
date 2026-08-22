const _ENCODING_SYMBOLS = [
  '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', 'A', 'B', 'C', 'D', 'E', 'F',
  'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q',
  'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z',
];

const _rand = () => {
  const rootLookup = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
  const globalCrypto = (rootLookup && (rootLookup.crypto || rootLookup.msCrypto)) ||
    (typeof crypto !== "undefined" ? crypto : null);
  if (typeof globalCrypto?.getRandomValues === "function") {
    const rMid = new Uint32Array(2);
    crypto.getRandomValues(rMid);
    const nMid = rMid[0] * 256 + (rMid[1] % 16777216);

    const rCnt = new Uint32Array(1);
    crypto.getRandomValues(rCnt);
    const nCnt = rCnt[0] % 1048576;
    return [nMid, nCnt];
  } else if (typeof globalCrypto?.randomBytes === "function") {
    const rMid = globalCrypto.randomBytes(5);
    const nMid = rMid.readUIntBE(0, 5);

    const rCnt = globalCrypto.randomBytes(3);
    const nCnt = rCnt.readUIntBE(0, 3) % 1048576;
    return [nMid, nCnt];
  } else if (crypto?.randomBytes) {
    const rMid = crypto.randomBytes(5);
    const nMid = rMid.readUIntBE(0, 5) ;

    const rCnt = crypto.randomBytes(3);
    const nCnt = rCnt.readUIntBE(0, 3) % 1048576;
    return [nMid, nCnt];
  } else {
    return [
      Math.floor(Math.random() * 1099511627776),
      Math.floor(Math.random() * 1048576)
    ];
  }
}

const _INCEPTION = 1767225600000
const [_MACHINE_ID, _COUNTER] = _rand();
var _counterValue = _COUNTER;

const _timestamp = (unix_ts) => {
  return unix_ts - _INCEPTION;
};

const _counter = () => {
  _counterValue = (_counterValue + 1) % 1048576;
  return _counterValue;
};

const _encode = (ts, mid, cnt) => {
  let encoded = new Array(20);
  for (let i = 7; i >= 0; i--) {
    encoded[i] = _ENCODING_SYMBOLS[ts % 32];
    encoded[i + 8] = _ENCODING_SYMBOLS[mid % 32];
    ts = Math.floor(ts / 32);
    mid = Math.floor(mid / 32);
  }
  for (let i = 19; i > 15; i--) {
    encoded[i] = _ENCODING_SYMBOLS[cnt % 32];
    cnt = Math.floor(cnt / 32);
  }
  return encoded.join("");
};

function genId() {
  const unix_ts = Date.now();
  const encoded = _encode(_timestamp(unix_ts), _MACHINE_ID, _counter());
  return encoded;
}

function genIdWithTime() {
  const unix_ts = Date.now();
  const encoded = _encode(_timestamp(unix_ts), _MACHINE_ID, _counter());
  return { id: encoded, ts: unix_ts };
}

/// DECODER

const MCP = -1;
const DECODING_SYMBOLS = [
  MCP, MCP, MCP, MCP, MCP, MCP, MCP, MCP, // 0
  MCP, MCP, MCP, MCP, MCP, MCP, MCP, MCP, // 8
  MCP, MCP, MCP, MCP, MCP, MCP, MCP, MCP, // 16
  MCP, MCP, MCP, MCP, MCP, MCP, MCP, MCP, // 24
  MCP, MCP, MCP, MCP, MCP, MCP, MCP, MCP, // 32
  MCP, MCP, MCP, MCP, MCP, MCP, MCP, MCP, // 40
  0, 1, 2, 3, 4, 5, 6, 7,                 // 48
  8, 9, MCP, MCP, MCP, MCP, MCP, MCP,     // 56
  MCP, 10, 11, 12, 13, 14, 15, 16,        // 64
  17, 1, 18, 19, 1, 20, 21, 0,            // 72
  22, 23, 24, 25, 26, MCP, 27, 28,        // 80
  29, 30, 31, MCP, MCP, MCP, MCP, MCP,    // 88
  MCP, 10, 11, 12, 13, 14, 15, 16,        // 96
  17, 1, 18, 19, 1, 20, 21, 0,            // 104
  22, 23, 24, 25, 26, MCP, 27, 28,        // 112
  29, 30, 31,                             // 120
];

function inspect(encoded) {
  let ts = 0;
  let mid = 0;
  let cnt = 0;
  for (let i = 0; i < 8; i++) {
    let cp = DECODING_SYMBOLS[encoded.charCodeAt(i)];
    if (cp == MCP) {
      return null;
    }
    ts = ts * 32 + cp;
  }
  for (let i = 8; i < 16; i++) {
    let cp = DECODING_SYMBOLS[encoded.charCodeAt(i)];
    if (cp == MCP) {
      return null;
    }
    mid = mid * 32 + cp;
  }
  for (let i = 16; i < 20; i++) {
    let cp = DECODING_SYMBOLS[encoded.charCodeAt(i)];
    if (cp == MCP) {
      return null;
    }
    cnt = cnt * 32 + cp;
  }
  return { ts: ts + _INCEPTION, mid: mid, cnt: cnt };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    genId,
    genIdWithTime,
    inspect,
  };
}

if (typeof window !== "undefined") {
  window.RecordID = { genId, genIdWithTime, inspect };
}
