/*
====================================================
 V CANDLE TERMINAL
 PHASE 2 — 3 MINUTE CANDLE ENGINE
====================================================

Current:
✓ Simulated live ticks
✓ 3-minute candle construction
✓ OHLC
✓ Volume
✓ Live candle updating
✓ Closed candle storage
✓ Candlestick chart

Later:
→ FYERS WebSocket
→ Exact V Candle V2
→ V Slope
→ VLOT
====================================================
*/


// ==================================================
// DOM
// ==================================================

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

const priceElement = document.getElementById("price");
const statusElement = document.getElementById("status");
const lastTimeElement = document.getElementById("lastTime");

const symbolElement = document.getElementById("symbol");
const chartSymbol = document.getElementById("chartSymbol");


// ==================================================
// SETTINGS
// ==================================================

const TIMEFRAME_MINUTES = 3;

const MAX_CANDLES = 100;

const START_PRICE = 25100;


// ==================================================
// CANDLE STORAGE
// ==================================================

// Completed candles
let candles = [];

// Current candle being built
let currentCandle = null;


// ==================================================
// SIMULATED MARKET
// ==================================================

let simulatedPrice = START_PRICE;

let simulatedVolume = 0;


// Starting simulated time

let simulatedTime = new Date();

simulatedTime.setHours(13);
simulatedTime.setMinutes(0);
simulatedTime.setSeconds(0);
simulatedTime.setMilliseconds(0);


// ==================================================
// HELPER — FORMAT TIME
// ==================================================

function formatTime(date) {

    const hours = String(
        date.getHours()
    ).padStart(2, "0");

    const minutes = String(
        date.getMinutes()
    ).padStart(2, "0");

    return `${hours}:${minutes}`;
}


// ==================================================
// HELPER — GET 3-MINUTE CANDLE START
// ==================================================

function getCandleStart(date) {

    const result = new Date(date);

    const minutes = result.getMinutes();

    const candleMinute =
        Math.floor(minutes / TIMEFRAME_MINUTES)
        * TIMEFRAME_MINUTES;

    result.setMinutes(candleMinute);

    result.setSeconds(0);

    result.setMilliseconds(0);

    return result;
}


// ==================================================
// CREATE NEW CANDLE
// ==================================================

function createCandle(price, time, volume) {

    const candleStart =
        getCandleStart(time);

    return {

        time: formatTime(candleStart),

        timestamp: candleStart.getTime(),

        open: price,

        high: price,

        low: price,

        close: price,

        volume: volume

    };
}


// ==================================================
// PROCESS TICK
// ==================================================

function processTick(price, time, volume = 1) {

    const candleStart =
        getCandleStart(time);


    // ----------------------------------------------
    // FIRST CANDLE
    // ----------------------------------------------

    if (currentCandle === null) {

        currentCandle =
            createCandle(
                price,
                time,
                volume
            );

        return;
    }


    // ----------------------------------------------
    // SAME 3-MINUTE CANDLE
    // ----------------------------------------------

    if (
        candleStart.getTime()
        === currentCandle.timestamp
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

        currentCandle.volume += volume;

        return;
    }


    // ----------------------------------------------
    // NEW 3-MINUTE CANDLE
    // ----------------------------------------------

    closeCurrentCandle();


    currentCandle =
        createCandle(
            price,
            time,
            volume
        );
}


// ==================================================
// CLOSE CURRENT CANDLE
// ==================================================

function closeCurrentCandle() {

    if (!currentCandle) {
        return;
    }


    // Save completed candle

    candles.push({
        ...currentCandle
    });


    // Limit stored candles

    if (candles.length > MAX_CANDLES) {

        candles.shift();

    }


    // Update terminal

    updateTerminal();


    // Draw

    drawChart();
}


// ==================================================
// SIMULATE MARKET TICK
// ==================================================

function generateTick() {

    /*
        Small random movement.

        This is ONLY test data.
        It will later be replaced by FYERS ticks.
    */


    const movement =
        (Math.random() - 0.48)
        * 18;


    simulatedPrice += movement;


    // Prevent unrealistic negative movement

    if (simulatedPrice < 100) {

        simulatedPrice = 100;

    }


    const volume =
        Math.floor(
            Math.random() * 500
        ) + 100;


    simulatedVolume += volume;


    processTick(
        simulatedPrice,
        simulatedTime,
        volume
    );


    // Move simulated clock forward

    simulatedTime =
        new Date(
            simulatedTime.getTime()
            + 10000
        );


    // Update live display

    updateLiveDisplay();
}


// ==================================================
// LIVE DISPLAY
// ==================================================

function updateLiveDisplay() {

    if (!currentCandle) {
        return;
    }


    priceElement.textContent =
        currentCandle.close.toFixed(2);


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
// TERMINAL UPDATE
// ==================================================

function updateTerminal() {

    const last =
        candles.length > 0
            ? candles[candles.length - 1]
            : currentCandle;


    if (!last) {
        return;
    }


    priceElement.textContent =
        last.close.toFixed(2);


    lastTimeElement.textContent =
        last.time;


    statusElement.textContent =
        "SIMULATION";


    // ----------------------------------------------
    // INDICATOR PLACEHOLDERS
    // ----------------------------------------------

    document.getElementById(
        "vCandleValue"
    ).textContent = "--";


    document.getElementById(
        "vSlopeValue"
    ).textContent = "--";


    document.getElementById(
        "vlotValue"
    ).textContent = "--";
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
// DRAW CANDLESTICK CHART
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


    // ----------------------------------------------
    // COMBINE CLOSED + CURRENT CANDLE
    // ----------------------------------------------

    let displayCandles =
        [...candles];


    if (currentCandle) {

        displayCandles.push(
            currentCandle
        );

    }


    if (displayCandles.length === 0) {
        return;
    }


    // ----------------------------------------------
    // PRICE RANGE
    // ----------------------------------------------

    let highest =
        Math.max(
            ...displayCandles.map(
                candle => candle.high
            )
        );


    let lowest =
        Math.min(
            ...displayCandles.map(
                candle => candle.low
            )
        );


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
                (price - lowest)
                /
                (highest - lowest)
            )
            * height;
    }


    // ----------------------------------------------
    // GRID
    // ----------------------------------------------

    ctx.strokeStyle =
        "#20242a";

    ctx.lineWidth = 1;


    for (let i = 1; i < 6; i++) {

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
    // CANDLE WIDTH
    // ----------------------------------------------

    const spacing =
        width /
        displayCandles.length;


    const candleWidth =
        Math.max(
            3,
            spacing * 0.55
        );


    // ----------------------------------------------
    // DRAW CANDLES
    // ----------------------------------------------

    displayCandles.forEach(
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


            // Wick

            ctx.strokeStyle =
                bullish
                    ? "#35d07f"
                    : "#ff5f56";


            ctx.lineWidth = 1;


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
                        openY - closeY
                    )
                );


            ctx.fillStyle =
                bullish
                    ? "#35d07f"
                    : "#ff5f56";


            ctx.fillRect(
                x -
                candleWidth / 2,

                bodyTop,

                candleWidth,

                bodyHeight
            );

        }
    );


    // ----------------------------------------------
    // CURRENT PRICE LINE
    // ----------------------------------------------

    const last =
        displayCandles[
            displayCandles.length - 1
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
// SYMBOL CHANGE
// ==================================================

symbolElement.addEventListener(
    "change",
    function () {

        chartSymbol.textContent =
            symbolElement.value;

    }
);


// ==================================================
// DEBUG INFORMATION
// ==================================================

function printDebug() {

    console.log(
        "-----------------------------"
    );

    console.log(
        "V CANDLE TERMINAL"
    );

    console.log(
        "Completed candles:",
        candles.length
    );

    console.log(
        "Current candle:",
        currentCandle
    );

    console.log(
        "Current price:",
        simulatedPrice
    );

    console.log(
        "-----------------------------"
    );
}


// ==================================================
// START TERMINAL
// ==================================================

resizeCanvas();


// Generate simulated ticks
// every 10 seconds of simulated market time

setInterval(
    generateTick,
    500
);


// Debug every 10 seconds

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
    "PHASE 2 — CANDLE ENGINE READY"
);

console.log(
    "3 MINUTE OHLC ENGINE ACTIVE"
);

console.log(
    "================================"
);
