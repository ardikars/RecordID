# Record ID

A 20-character, lexicographically-sortable unique identifier with a per-process machine identifier.

## Format at a glance

| Field        | Bits | Chars (Base32) | Description                      |
| ------------ | ---: | :------------: | -------------------------------- |
| `timestamp`  |   40 |        8       | ms since `INCEPTION` (see below) |
| `machine_id` |   40 |        8       | random per process (CSPRNG)      |
| `counter`    |   20 |        4       | atomic counter                   |
| **Total**    |  100 |      **20**    | final 20-character ID            |

* **Length** — always exactly **20** characters.
* **Alphabet** — Crockford-style Base32:
  `0 1 2 3 4 5 6 7 8 9 A B C D E F G H J K M N P Q R S T V W X Y Z`
  (the letters `I`, `L`, `O`, `U` are deliberately omitted to avoid visual confusion).
* **Endianness** — within each field the most-significant 5-bit chunk is printed first, so the raw string sorts correctly by time when the other fields are equal.

### Inception epoch

```
INCEPTION = 1767225600000 ms = 2026-01-01T00:00:00Z
```

The 40-bit timestamp is `unix_ms - INCEPTION`. With 40 bits at millisecond resolution the epoch rolls over after `2⁴⁰ ms ≈ 34.86 years`, so the format is usable until **late 2060**.


### Encoding

The three integers are packed into a 100-bit buffer in this order:

```
[ timestamp (40b) | machine_id (40b) | counter (20b) ]
```

Then the buffer is sliced into 5-bit groups and each group is mapped through the alphabet:

```text
encoded[0..8]   = timestamp  chunks, MSB first
encoded[8..16]  = machine_id chunks, MSB first
encoded[16..20] = counter    chunks, MSB first
```

#### Python Reference Implementation

```python
#!/usr/bin/env python3

ENCODING_SYMBOLS = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ"

import atomics
import secrets
import time

# Inception epoch (2026-01-01T00:00:00Z)
_INCEPTION = 1767225600000
# Per-process random 40-bit machine ID
_MACHINE_ID = secrets.randbits(40)

# Per-process 20-bit wrapping counter (incremented per ID)
_COUNTER = atomics.atomic(width=4, atype=atomics.UINT)
_COUNTER.store(secrets.randbits(20))

def _timestamp(unix_ts):
    return unix_ts - _INCEPTION

def _counter():
    while True:
        old = _COUNTER.load(atomics.MemoryOrder.RELAXED)
        next = (old + 1) & 0x000FFFFF
        if _COUNTER.cmpxchg_weak(old, next):
            return next

def _encode(ts, mid, cnt):
    encoded = bytearray(20)
    for i in range(7, -1, -1):
        encoded[i] = ENCODING_SYMBOLS[ts & 0x1F]
        encoded[i + 8] = ENCODING_SYMBOLS[mid & 0x1F]
        ts >>= 5
        mid >>= 5
    for i in range(19, 15, -1):
        encoded[i] = ENCODING_SYMBOLS[cnt & 0x1F]
        cnt >>= 5
    return encoded.decode('utf-8')

def gen_id():
    unix_ts = time.time_ns() // 1_000_000 # Milliseconds since Unix Epoch
    return _encode(_timestamp(unix_ts), _MACHINE_ID, _counter())

def gen_id_with_time():
    unix_ts = time.time_ns() // 1_000_000 # Milliseconds since Unix Epoch
    encoded = _encode(_timestamp(unix_ts), _MACHINE_ID, _counter())
    return (encoded, unix_ts)
```

## Properties

* **Sortable.** Lexicographic order of the 20-char string matches chronological order for IDs minted on the same machine (process).
* **Unique per process.** The 40-bit machine id makes collisions between processes vanishingly unlikely (`2⁴⁰ ≈ 1.1 × 10¹²`); timestamp and the 20-bit counter with a random seed remove collisions inside a single process.
* **Fixed length.** Always 20 chars — safe as a database key without padding.
* **URL / file-system safe.** Pure ASCII, no special characters.

## License

Public domain.
