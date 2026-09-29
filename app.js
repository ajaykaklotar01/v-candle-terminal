/*
====================================================
 V CANDLE TERMINAL
 PHASE 3

 ✓ Simulated ticks
 ✓ 3-minute OHLC
 ✓ Normal candles
 ✓ Exact V Candle calculation
 ✓ Smooth EMA 45
 ✓ After EMA 45
 ✓ Doji threshold 0.03
====================================================
*/


// ==================================================
// DOM
// ==================================================

const canvas =
    document.getElementById("chart");

const ctx =
    canvas.getContext("2d");

const priceElement =
    document.getElementById("price");

const statusElement =
    document.getElementById("status");

const lastTimeElement =
    document.getElementById("lastTime");

const symbolElement =
    document.getElementById("symbol");

const chartSymbol =
    document.getElementById("chartSymbol");


// ==================================================
// SETTINGS
// ==================================================

const TIMEFRAME_MINUTES = 3;

const MAX_CANDLES = 150;

const START_PRICE = 25100;


// V CANDLE SETTINGS

const V_SMOOTH_LEN = 45;

const V_AFTER_LEN = 45;

const V_DOJI_THRESHOLD = 0.03;


// ==================================================
// MARKET DATA
// ==================================================

let candles = [];

let currentCandle = null;

let simulatedPrice =
    START_PRICE;

let simulatedVolume = 0;


// ==================================================
// SIMULATED TIME
// ==================================================

let simulatedTime =
    new Date();

simulatedTime.setHours(13);

simulatedTime.setMinutes(0);

simulatedTime.setSeconds(0);

simulatedTime.setMilliseconds(0);


// ==================================================
// FORMAT TIME
// ==================================================

function formatTime(date) {

    const hours =
        String(
            date.getHours()
        ).padStart(2, "0");


    const minutes =
        String(
            date.getMinutes()
        ).padStart(2, "0");


    return `${hours}:${minutes}`;
}


// ==================================================
// 3-MINUTE CANDLE START
// ==================================================

function getCandleStart(date) {

    const result =
        new Date(date);


    const minutes =
        result.getMinutes();


    const candleMinute =
        Math.floor(
            minutes /
            TIMEFRAME_MINUTES
        ) *
        TIMEFRAME_MINUTES;


    result.setMinutes(
        candleMinute
    );


    result.setSeconds(0);

    result.setMilliseconds(0);


    return result;
}


// ==================================================
// CREATE CANDLE
// ==================================================

function createCandle(
    price,
    time,
    volume
) {

    const candleStart =
        getCandleStart(time);


    return {

        time:
            formatTime(
                candleStart
            ),

        timestamp:
            candleStart.getTime(),

        open:
            price,

        high:
            price,

        low:
            price,

        close:
            price,

        volume:
            volume
    };
}


// ==================================================
// PROCESS TICK
// ==================================================

function processTick(
    price,
    time,
    volume = 1
) {

    const candleStart =
        getCandleStart(time);


    // FIRST CANDLE

    if (currentCandle === null) {

        currentCandle =
            createCandle(
                price,
                time,
                volume
            );

        return;
    }


    // SAME CANDLE

    if (
        candleStart.getTime()
        ===
        currentCandle.timestamp
    ) {

        currentCandle.high =
            Math.max(
                currentCandle.high,
                price
            );


        currentCandle.low =
            Math.min(
                currentCandle.low,
                price
            );


        currentCandle.close =
            price;


        currentCandle.volume +=
            volume;


        return;
    }


    // NEW CANDLE

    closeCurrentCandle();


    currentCandle =
        createCandle(
            price,
            time,
            volume
        );
}


// ==================================================
// CLOSE CANDLE
// ==================================================

function closeCurrentCandle() {

    if (!currentCandle) {
        return;
    }


    candles.push({
        ...currentCandle
    });


    if (
        candles.length >
        MAX_CANDLES
    ) {

        candles.shift();

    }


    updateTerminal();

    drawChart();
}


// ==================================================
// GET DISPLAY CANDLES
// ==================================================

function getDisplayCandles() {

    const result =
        [...candles];


    if (currentCandle) {

        result.push(
            currentCandle
        );

    }


    return result;
}


// ==================================================
// GENERATE SIMULATED TICK
// ==================================================

function generateTick() {

    const movement =
        (
            Math.random() -
            0.48
        ) * 18;


    simulatedPrice +=
        movement;


    if (
        simulatedPrice < 100
    ) {

        simulatedPrice = 100;

    }


    const volume =
        Math.floor(
            Math.random() * 500
        ) + 100;


    simulatedVolume +=
        volume;


    processTick(
        simulatedPrice,
        simulatedTime,
        volume
    );


    simulatedTime =
        new Date(
            simulatedTime.getTime()
            + 10000
        );


    updateLiveDisplay();

    drawChart();
}


// ==================================================
// LIVE DISPLAY
// ==================================================

function updateLiveDisplay() {

    if (!currentCandle) {
        return;
    }


    priceElement.textContent =
        currentCandle.close
            .toFixed(2);


    lastTimeElement.textContent =
        currentCandle.time;


    statusElement.textContent =
        "SIMULATION";


    document.getElementById(
        "dataSource"
    ).textContent =
        "SIMULATED TICKS";


    document.getElementById(
        "candleEngine"
    ).textContent =
        "3 MIN OHLC";
}


// ==================================================
// CALCULATE V CANDLE
// ==================================================

function getVCandleData() {

    const data =
        getDisplayCandles();


    if (data.length === 0) {

        return [];

    }


    return calculateVCandle(

        data,

        V_SMOOTH_LEN,

        V_AFTER_LEN,

        V_DOJI_THRESHOLD

    );
}


// ==================================================
// UPDATE V CANDLE DISPLAY
// ==================================================

function updateVCandleDisplay() {

    const vData =
        getVCandleData();


    if (vData.length === 0) {
        return;
    }


    const last =
        vData[
            vData.length - 1
        ];


    const value =
        document.getElementById(
            "vCandleValue"
        );


    const signal =
        document.getElementById(
            "vCandleSignal"
        );


    value.textContent =
        last.close.toFixed(2);


    if (last.isDoji) {

        signal.textContent =
            "DOJI";

    } else if (
        last.color ===
        "bullish"
    ) {

        signal.textContent =
            "BULLISH";

    } else {

        signal.textContent =
            "BEARISH";
    }
}


// ==================================================
// TERMINAL UPDATE
// ==================================================

function updateTerminal() {

    updateLiveDisplay();

    updateVCandleDisplay();


    // V SLOPE — NEXT PHASE

    document.getElementById(
        "vSlopeValue"
    ).textContent =
        "--";


    // VLOT — NEXT PHASE

    document.getElementById(
        "vlotValue"
    ).textContent =
        "--";
}


// ==================================================
// CANVAS RESIZE
// ==================================================

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();


    canvas.width =
        rect.width *
        window.devicePixelRatio;


    canvas.height =
        rect.height *
        window.devicePixelRatio;


    ctx.setTransform(
        window.devicePixelRatio,
        0,
        0,
        window.devicePixelRatio,
        0,
        0
    );


    drawChart();
}


window.addEventListener(
    "resize",
    resizeCanvas
);


// ==================================================
// DRAW CHART
// ==================================================

function drawChart() {

    const width =
        canvas.clientWidth;


    const height =
        canvas.clientHeight;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const normalCandles =
        getDisplayCandles();


    if (
        normalCandles.length === 0
    ) {

        return;
    }


    // ----------------------------------------------
    // V CANDLE DATA
    // ----------------------------------------------

    const vCandles =
        getVCandleData();


    // ----------------------------------------------
    // PRICE RANGE
    // ----------------------------------------------

    let highest =
        Math.max(
            ...normalCandles.map(
                c => c.high
            )
        );


    let lowest =
        Math.min(
            ...normalCandles.map(
                c => c.low
            )
        );


    // Include V Candle range

    if (vCandles.length > 0) {

        highest =
            Math.max(
                highest,

                ...vCandles.map(
                    c => c.high
                )
            );


        lowest =
            Math.min(
                lowest,

                ...vCandles.map(
                    c => c.low
                )
            );
    }


    const range =
        highest - lowest;


    const padding =
        range === 0
            ? 50
            : range * 0.12;


    highest += padding;

    lowest -= padding;


    // ----------------------------------------------
    // PRICE → Y
    // ----------------------------------------------

    function priceToY(price) {

        return height -
            (
                (
                    price -
                    lowest
                )
                /
                (
                    highest -
                    lowest
                )
            )
            *
            height;
    }


    // ----------------------------------------------
    // GRID
    // ----------------------------------------------

    ctx.strokeStyle =
        "#20242a";

    ctx.lineWidth = 1;


    for (
        let i = 1;
        i < 6;
        i++
    ) {

        const y =
            height * i / 6;


        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();
    }


    // ----------------------------------------------
    // NORMAL CANDLES
    // ----------------------------------------------

    const spacing =
        width /
        normalCandles.length;


    const normalWidth =
        Math.max(
            3,
            spacing * 0.45
        );


    normalCandles.forEach(
        (candle, index) => {

            const x =
                spacing * index
                +
                spacing / 2;


            const openY =
                priceToY(
                    candle.open
                );


            const closeY =
                priceToY(
                    candle.close
                );


            const highY =
                priceToY(
                    candle.high
                );


            const lowY =
                priceToY(
                    candle.low
                );


            const bullish =
                candle.close >=
                candle.open;


            ctx.strokeStyle =
                bullish
                    ? "#35d07f"
                    : "#ff5f56";


            ctx.lineWidth = 1;


            // Wick

            ctx.beginPath();

            ctx.moveTo(
                x,
                highY
            );

            ctx.lineTo(
                x,
                lowY
            );

            ctx.stroke();


            // Body

            const bodyTop =
                Math.min(
                    openY,
                    closeY
                );


            const bodyHeight =
                Math.max(
                    2,
                    Math.abs(
                        openY -
                        closeY
                    )
                );


            ctx.fillStyle =
                bullish
                    ? "#35d07f"
                    : "#ff5f56";


            ctx.fillRect(
                x -
                normalWidth / 2,

                bodyTop,

                normalWidth,

                bodyHeight
            );

        }
    );


    // ----------------------------------------------
    // V CANDLE OVERLAY
    // ----------------------------------------------

    if (vCandles.length > 0) {

        const vSpacing =
            width /
            vCandles.length;


        const vWidth =
            Math.max(
                5,
                vSpacing * 0.68
            );


        vCandles.forEach(
            (candle, index) => {

                const x =
                    vSpacing * index
                    +
                    vSpacing / 2;


                const openY =
                    priceToY(
                        candle.open
                    );


                const closeY =
                    priceToY(
                        candle.close
                    );


                const highY =
                    priceToY(
                        candle.high
                    );


                const lowY =
                    priceToY(
                        candle.low
                    );


                // V Candle colour

                let color;


                if (
                    candle.isDoji
                ) {

                    color =
                        "#777777";

                } else if (
                    candle.color ===
                    "bullish"
                ) {

                    color =
                        "#66d98a";

                } else {

                    color =
                        "#ff7770";
                }


                // Wick

                ctx.strokeStyle =
                    color;

                ctx.lineWidth = 2;


                ctx.beginPath();

                ctx.moveTo(
                    x,
                    highY
                );

                ctx.lineTo(
                    x,
                    lowY
                );

                ctx.stroke();


                // Body

                const bodyTop =
                    Math.min(
                        openY,
                        closeY
                    );


                const bodyHeight =
                    Math.max(
                        3,
                        Math.abs(
                            openY -
                            closeY
                        )
                    );


                ctx.fillStyle =
                    color;


                ctx.globalAlpha =
                    0.45;


                ctx.fillRect(
                    x -
                    vWidth / 2,

                    bodyTop,

                    vWidth,

                    bodyHeight
                );


                ctx.globalAlpha =
                    1;

            }
        );
    }


    // ----------------------------------------------
    // CURRENT PRICE LINE
    // ----------------------------------------------

    const last =
        normalCandles[
            normalCandles.length - 1
        ];


    const lastY =
        priceToY(
            last.close
        );


    ctx.strokeStyle =
        "#777";


    ctx.setLineDash(
        [4, 4]
    );


    ctx.beginPath();

    ctx.moveTo(
        0,
        lastY
    );

    ctx.lineTo(
        width,
        lastY
    );

    ctx.stroke();


    ctx.setLineDash([]);


    // ----------------------------------------------
    // PRICE LABEL
    // ----------------------------------------------

    ctx.fillStyle =
        "#ddd";


    ctx.font =
        "11px Arial";


    ctx.fillText(
        last.close.toFixed(2),
        8,
        Math.max(
            14,
            lastY - 5
        )
    );
}


// ==================================================
// SYMBOL
// ==================================================

symbolElement.addEventListener(
    "change",
    function () {

        chartSymbol.textContent =
            symbolElement.value;

    }
);


// ==================================================
// DEBUG
// ==================================================

function printDebug() {

    const vData =
        getVCandleData();


    console.log(
        "=============================="
    );


    console.log(
        "V CANDLE TERMINAL"
    );


    console.log(
        "Normal candles:",
        candles.length
    );


    console.log(
        "Current candle:",
        currentCandle
    );


    if (vData.length > 0) {

        console.log(
            "Latest V Candle:",
            vData[
                vData.length - 1
            ]
        );

    }


    console.log(
        "=============================="
    );
}


// ==================================================
// START
// ==================================================

resizeCanvas();

updateTerminal();


setInterval(
    generateTick,
    500
);


setInterval(
    printDebug,
    10000
);


console.log(
    "================================"
);

console.log(
    "V CANDLE TERMINAL"
);

console.log(
    "PHASE 3 — V CANDLE ENGINE READY"
);

console.log(
    "SMOOTH LEN: 45"
);

console.log(
    "AFTER LEN: 45"
);

console.log(
    "DOJI: 0.03"
);

console.log(
    "================================"
);
