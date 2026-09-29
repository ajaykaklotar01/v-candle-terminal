// ==========================================
// AJAY V SLOPE
// Ported from AJAY V ROOT Pine Script
// ==========================================

function calculateEMA(values, length) {
    const result = new Array(values.length).fill(null);

    if (values.length === 0 || length <= 0) {
        return result;
    }

    const alpha = 2 / (length + 1);

    let previous = null;

    for (let i = 0; i < values.length; i++) {
        const value = values[i];

        if (value == null || !Number.isFinite(value)) {
            continue;
        }

        if (previous === null) {
            previous = value;
        } else {
            previous = alpha * value + (1 - alpha) * previous;
        }

        result[i] = previous;
    }

    return result;
}


// ------------------------------------------
// True Range
// ------------------------------------------

function calculateTrueRange(candles) {
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
// Pine ta.atr() uses RMA(TR)
// ------------------------------------------

function calculateRMA(values, length) {
    const result = new Array(values.length).fill(null);

    if (values.length === 0 || length <= 0) {
        return result;
    }

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

        previous = ((previous * (length - 1)) + value) / length;
        result[i] = previous;
    }

    return result;
}


// ------------------------------------------
// V SLOPE
// ------------------------------------------

function calculateVSlope(
    candles,
    smoothLen = 60,
    afterLen = 60,
    slopeEMA = 5,
    neutralZone = 0.03
) {

    if (!candles || candles.length === 0) {
        return [];
    }

    // SOURCE
    const srcOpen = candles.map(c => c.open);
    const srcHigh = candles.map(c => c.high);
    const srcLow = candles.map(c => c.low);
    const srcClose = candles.map(c => c.close);

    // FIRST LEN
    const sOpen = calculateEMA(srcOpen, smoothLen);
    const sHigh = calculateEMA(srcHigh, smoothLen);
    const sLow = calculateEMA(srcLow, smoothLen);
    const sClose = calculateEMA(srcClose, smoothLen);

    // V CANDLE FIRST STAGE
    const haClose1 = new Array(candles.length).fill(null);
    const haOpen1 = new Array(candles.length).fill(null);
    const haHigh1 = new Array(candles.length).fill(null);
    const haLow1 = new Array(candles.length).fill(null);

    for (let i = 0; i < candles.length; i++) {

        if (
            sOpen[i] == null ||
            sHigh[i] == null ||
            sLow[i] == null ||
            sClose[i] == null
        ) {
            continue;
        }

        // haClose1
        haClose1[i] =
            (sOpen[i] +
             sHigh[i] +
             sLow[i] +
             sClose[i]) / 4;

        // haOpen1
        if (i === 0 || haOpen1[i - 1] == null || haClose1[i - 1] == null) {
            haOpen1[i] =
                (sOpen[i] + sClose[i]) / 2;
        } else {
            haOpen1[i] =
                (haOpen1[i - 1] + haClose1[i - 1]) / 2;
        }

        // haHigh1
        haHigh1[i] = Math.max(
            sHigh[i],
            haOpen1[i],
            haClose1[i]
        );

        // haLow1
        haLow1[i] = Math.min(
            sLow[i],
            haOpen1[i],
            haClose1[i]
        );
    }

    // SECOND V CANDLE SMOOTHING
    const o1 = calculateEMA(haOpen1, afterLen);
    const c1 = calculateEMA(haClose1, afterLen);

    // V CANDLE MIDPOINT
    const vMid = new Array(candles.length).fill(null);

    for (let i = 0; i < candles.length; i++) {
        if (o1[i] != null && c1[i] != null) {
            vMid[i] = (o1[i] + c1[i]) / 2;
        }
    }

    // RAW SLOPE
    const rawSlope = new Array(candles.length).fill(null);

    for (let i = 1; i < candles.length; i++) {
        if (vMid[i] != null && vMid[i - 1] != null) {
            rawSlope[i] = vMid[i] - vMid[i - 1];
        }
    }

    // EMA 5 ON MOVEMENT
    const vSlopeRaw = calculateEMA(rawSlope, slopeEMA);

    // ATR(14)
    const trueRange = calculateTrueRange(candles);
    const atr14 = calculateRMA(trueRange, 14);

    // FINAL V SLOPE
    const result = [];

    for (let i = 0; i < candles.length; i++) {

        let vSlope = null;
        let state = "NEUTRAL";

        if (
            vSlopeRaw[i] != null &&
            atr14[i] != null &&
            atr14[i] !== 0
        ) {
            vSlope = vSlopeRaw[i] / atr14[i];

            if (vSlope > neutralZone) {
                state = "BULLISH";
            } else if (vSlope < -neutralZone) {
                state = "BEARISH";
            } else {
                state = "NEUTRAL";
            }
        }

        result.push({
            time: candles[i].time,
            value: vSlope,
            bullishLevel: neutralZone,
            bearishLevel: -neutralZone,
            state: state
        });
    }

    return result;
}
