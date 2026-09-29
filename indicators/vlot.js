// ==========================================
// AJAY VLOT
// Ported from AJAY V ROOT Pine Script
// ==========================================


// ------------------------------------------
// True Range
// ------------------------------------------

function calculateVLOTTrueRange(candles) {

    const tr = new Array(candles.length).fill(null);

    for (let i = 0; i < candles.length; i++) {

        const c = candles[i];

        if (i === 0) {
            tr[i] = c.high - c.low;
        } else {

            const previousClose = candles[i - 1].close;

            tr[i] = Math.max(
                c.high - c.low,
                Math.abs(c.high - previousClose),
                Math.abs(c.low - previousClose)
            );
        }
    }

    return tr;
}


// ------------------------------------------
// Wilder RMA
// Pine ta.atr() = RMA(True Range)
// ------------------------------------------

function calculateVLOTRMA(values, length) {

    const result = new Array(values.length).fill(null);

    let sum = 0;
    let count = 0;
    let previous = null;

    for (let i = 0; i < values.length; i++) {

        const value = values[i];

        if (value == null || !Number.isFinite(value)) {
            continue;
        }

        count++;

        if (count < length) {
            sum += value;
            continue;
        }

        if (count === length) {
            sum += value;
            previous = sum / length;
            result[i] = previous;
            continue;
        }

        previous =
            ((previous * (length - 1)) + value) / length;

        result[i] = previous;
    }

    return result;
}


// ------------------------------------------
// VLOT
// ------------------------------------------

function calculateVLOT(
    candles,
    atrLength = 14,
    atrMultiplier = 1.3,
    risk = 5,
    sldMode = "AUTO ATR",
    manualSLD = 10
) {

    if (!candles || candles.length === 0) {
        return null;
    }

    const trueRange =
        calculateVLOTTrueRange(candles);

    const atr =
        calculateVLOTRMA(trueRange, atrLength);

    const lastIndex = candles.length - 1;

    const atrValue = atr[lastIndex];

    if (atrValue == null || !Number.isFinite(atrValue)) {
        return {
            atr: null,
            slDistance: null,
            lotSize: null,
            risk: risk,
            mode: sldMode
        };
    }

    // AUTO ATR
    const autoSLD =
        atrValue * atrMultiplier;

    // SELECT SLD
    const slDistance =
        sldMode === "AUTO ATR"
            ? autoSLD
            : manualSLD;

    // LOT SIZE
    const lotSize =
        risk / slDistance;

    return {
        atr: atrValue,
        autoSLD: autoSLD,
        slDistance: slDistance,
        lotSize: lotSize,
        risk: risk,
        mode: sldMode,
        atrMultiplier: atrMultiplier
    };
        }
