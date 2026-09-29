/*
====================================================
 V CANDLE ENGINE
 Port of:
 🗿 AJAY V CANDLE
 Pine Script v6

 Settings:
 smoothLen = 45
 afterLen  = 45
 dojiThreshold = 0.03
====================================================
*/


// ==================================================
// EMA
// ==================================================

function calculateEMA(values, length) {

    const result = [];

    if (values.length === 0) {
        return result;
    }

    const alpha =
        2 / (length + 1);


    let previous = null;


    for (let i = 0; i < values.length; i++) {

        const value = values[i];


        if (
            value === null ||
            value === undefined ||
            Number.isNaN(value)
        ) {

            result.push(null);

            continue;
        }


        if (previous === null) {

            previous = value;

        } else {

            previous =
                alpha * value +
                (1 - alpha) * previous;

        }


        result.push(previous);
    }


    return result;
}


// ==================================================
// V CANDLE CALCULATION
// ==================================================

function calculateVCandle(
    candles,
    smoothLen = 45,
    afterLen = 45,
    dojiThreshold = 0.03
) {

    const count = candles.length;


    if (count === 0) {
        return [];
    }


    // ----------------------------------------------
    // SOURCE OHLC
    // ----------------------------------------------

    const srcOpen =
        candles.map(c => c.open);

    const srcHigh =
        candles.map(c => c.high);

    const srcLow =
        candles.map(c => c.low);

    const srcClose =
        candles.map(c => c.close);


    // ----------------------------------------------
    // FIRST EMA
    // ----------------------------------------------

    const sOpen =
        calculateEMA(
            srcOpen,
            smoothLen
        );

    const sHigh =
        calculateEMA(
            srcHigh,
            smoothLen
        );

    const sLow =
        calculateEMA(
            srcLow,
            smoothLen
        );

    const sClose =
        calculateEMA(
            srcClose,
            smoothLen
        );


    // ----------------------------------------------
    // FIRST V CANDLE
    // ----------------------------------------------

    const haOpen1 = [];
    const haClose1 = [];
    const haHigh1 = [];
    const haLow1 = [];


    for (let i = 0; i < count; i++) {

        const close =
            (
                sOpen[i] +
                sHigh[i] +
                sLow[i] +
                sClose[i]
            ) / 4;


        haClose1.push(close);


        let open;


        // Pine:
        //
        // var float haOpen1 = na
        //
        // haOpen1 :=
        //     na(haOpen1[1])
        //     ? (sOpen + sClose) / 2
        //     : (haOpen1[1] + haClose1[1]) / 2


        if (i === 0) {

            open =
                (
                    sOpen[i] +
                    sClose[i]
                ) / 2;

        } else {

            open =
                (
                    haOpen1[i - 1] +
                    haClose1[i - 1]
                ) / 2;

        }


        haOpen1.push(open);


        const high =
            Math.max(
                sHigh[i],
                haOpen1[i],
                haClose1[i]
            );


        const low =
            Math.min(
                sLow[i],
                haOpen1[i],
                haClose1[i]
            );


        haHigh1.push(high);

        haLow1.push(low);
    }


    // ----------------------------------------------
    // SECOND V CANDLE EMA
    // ----------------------------------------------

    const o1 =
        calculateEMA(
            haOpen1,
            afterLen
        );

    const h1 =
        calculateEMA(
            haHigh1,
            afterLen
        );

    const l1 =
        calculateEMA(
            haLow1,
            afterLen
        );

    const c1 =
        calculateEMA(
            haClose1,
            afterLen
        );


    // ----------------------------------------------
    // FINAL V CANDLE
    // ----------------------------------------------

    const result = [];


    for (let i = 0; i < count; i++) {

        const body =
            Math.abs(
                o1[i] -
                c1[i]
            );


        const candleRange =
            h1[i] -
            l1[i];


        const isDoji =
            candleRange > 0
                ? (
                    body /
                    candleRange
                ) < dojiThreshold
                : false;


        let color;


        if (isDoji) {

            color = "doji";

        } else if (c1[i] >= o1[i]) {

            color = "bullish";

        } else {

            color = "bearish";
        }


        result.push({

            time: candles[i].time,

            timestamp:
                candles[i].timestamp,

            open: o1[i],

            high: h1[i],

            low: l1[i],

            close: c1[i],

            body: body,

            range: candleRange,

            isDoji: isDoji,

            color: color

        });
    }


    return result;
  }
