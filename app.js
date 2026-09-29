// ==========================================
// AJAY V CANDLE TERMINAL
// ==========================================

// ------------------------------------------
// SETTINGS
// ------------------------------------------

const SETTINGS = {

    symbol: "NIFTY 50",

    timeframeMinutes: 3,

    // V CANDLE V2
    vCandleSmooth: 45,
    vCandleAfter: 45,
    vCandleDoji: 0.03,

    // V SLOPE
    vSlopeSmooth: 60,
    vSlopeAfter: 60,
    vSlopeEMA: 5,
    vSlopeNeutral: 0.03,

    // VLOT
    vLotATRLength: 14,
    vLotATRMultiplier: 1.3,
    vLotRisk: 5,
    vLotMode: "AUTO ATR",
    vLotManualSLD: 10
};


// ------------------------------------------
// MARKET DATA
// ------------------------------------------

let candles = [];

let currentCandle = null;

let simulatedPrice = 25100;

let simulatedTime =
    new Date(2026, 0, 1, 13, 0, 0);


// ------------------------------------------
// DOM ELEMENTS
// ------------------------------------------

const priceElement =
    document.getElementById("price");

const statusElement =
    document.getElementById("status");

const connectionElement =
    document.getElementById("connectionStatus");

const symbolElement =
    document.getElementById("symbol");


// V CANDLE
const vCandleValueElement =
    document.getElementById("vCandleValue");

const vCandleSignalElement =
    document.getElementById("vCandleSignal");


// V SLOPE
const vSlopeValueElement =
    document.getElementById("vSlopeValue");

const vSlopeSignalElement =
    document.getElementById("vSlopeSignal");


// VLOT
const vlotValueElement =
    document.getElementById("vlotValue");

const vlotSignalElement =
    document.getElementById("vlotSignal");


// ------------------------------------------
// CANVAS
// ------------------------------------------

const canvas =
    document.getElementById("chart");

const ctx =
    canvas ? canvas.getContext("2d") : null;


// ------------------------------------------
// 3 MINUTE CANDLE ENGINE
// ------------------------------------------

function getCandleStart(timestamp) {

    const date = new Date(timestamp);

    const minutes = date.getMinutes();

    const candleMinute =
        Math.floor(minutes / SETTINGS.timeframeMinutes)
        * SETTINGS.timeframeMinutes;

    date.setMinutes(candleMinute);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return date.getTime();
}


function processTick(price, timestamp) {

    const candleStart =
        getCandleStart(timestamp);

    // NEW CANDLE
    if (
        currentCandle === null ||
        currentCandle.time !== candleStart
    ) {

        // Save previous candle
        if (currentCandle !== null) {

            candles.push({
                ...currentCandle
            });

            // Keep last 150 candles
            if (candles.length > 150) {
                candles.shift();
            }
        }

        // Create new candle
        currentCandle = {

            time: candleStart,

            open: price,
            high: price,
            low: price,
            close: price,

            volume: 1
        };

    } else {

        // UPDATE CURRENT CANDLE

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

        currentCandle.volume++;
    }
}


// ------------------------------------------
// DISPLAY CANDLES
// ------------------------------------------

function getDisplayCandles() {

    const data =
        [...candles];

    if (currentCandle !== null) {

        data.push({
            ...currentCandle
        });
    }

    return data;
}


// ------------------------------------------
// V CANDLE V2
// ------------------------------------------

function updateVCandle() {

    const data =
        getDisplayCandles();

    if (
        typeof calculateVCandle !== "function" ||
        data.length === 0
    ) {
        return;
    }

    const result =
        calculateVCandle(
            data,
            SETTINGS.vCandleSmooth,
            SETTINGS.vCandleAfter,
            SETTINGS.vCandleDoji
        );

    if (
        !result ||
        result.length === 0
    ) {
        return;
    }

    const latest =
        result[result.length - 1];

    if (!latest) {
        return;
    }


    // VALUE

    if (vCandleValueElement) {

        vCandleValueElement.textContent =
            latest.close != null
                ? latest.close.toFixed(2)
                : "--";
    }


    // SIGNAL

    if (vCandleSignalElement) {

        if (latest.isDoji) {

            vCandleSignalElement.textContent =
                "DOJI";

        } else if (
            latest.color === "bullish"
        ) {

            vCandleSignalElement.textContent =
                "BULLISH";

        } else {

            vCandleSignalElement.textContent =
                "BEARISH";
        }
    }
}


// ------------------------------------------
// V SLOPE
// ------------------------------------------

function updateVSlope() {

    const data =
        getDisplayCandles();

    if (
        typeof calculateVSlope !== "function" ||
        data.length === 0
    ) {
        return;
    }

    const result =
        calculateVSlope(
            data,
            SETTINGS.vSlopeSmooth,
            SETTINGS.vSlopeAfter,
            SETTINGS.vSlopeEMA,
            SETTINGS.vSlopeNeutral
        );

    if (
        !result ||
        result.length === 0
    ) {
        return;
    }

    const latest =
        result[result.length - 1];

    if (!latest) {
        return;
    }


    // VALUE

    if (vSlopeValueElement) {

        vSlopeValueElement.textContent =
            latest.value != null
                ? latest.value.toFixed(4)
                : "--";
    }


    // SIGNAL

    if (vSlopeSignalElement) {

        vSlopeSignalElement.textContent =
            latest.state;
    }
}


// ------------------------------------------
// VLOT
// ------------------------------------------

function updateVLOT() {

    const data =
        getDisplayCandles();

    if (
        typeof calculateVLOT !== "function" ||
        data.length === 0
    ) {
        return;
    }

    const result =
        calculateVLOT(
            data,
            SETTINGS.vLotATRLength,
            SETTINGS.vLotATRMultiplier,
            SETTINGS.vLotRisk,
            SETTINGS.vLotMode,
            SETTINGS.vLotManualSLD
        );

    if (!result) {
        return;
    }


    // VALUE
    // Shows:
    // SLD / LOT

    if (vlotValueElement) {

        if (
            result.slDistance != null &&
            result.lotSize != null
        ) {

            vlotValueElement.textContent =
                "$" +
                result.slDistance.toFixed(2) +
                " / " +
                result.lotSize.toFixed(2);

        } else {

            vlotValueElement.textContent =
                "--";
        }
    }


    // SIGNAL

    if (vlotSignalElement) {

        if (
            result.slDistance != null &&
            result.lotSize != null
        ) {

            vlotSignalElement.textContent =
                "READY";

        } else {

            vlotSignalElement.textContent =
                "WAIT";
        }
    }
}


// ------------------------------------------
// UPDATE TERMINAL
// ------------------------------------------

function updateTerminal() {

    const displayCandles =
        getDisplayCandles();

    if (displayCandles.length === 0) {
        return;
    }

    const latest =
        displayCandles[
            displayCandles.length - 1
        ];


    // PRICE

    if (priceElement) {

        priceElement.textContent =
            latest.close.toFixed(2);
    }


    // INDICATORS

    updateVCandle();

    updateVSlope();

    updateVLOT();


    // CHART

    drawChart();
}


// ------------------------------------------
// SIMULATED MARKET
// ------------------------------------------

function generatePrice() {

    const movement =
        (Math.random() - 0.5) * 18;

    simulatedPrice += movement;


    // Keep simulation
    // around NIFTY-like range

    if (simulatedPrice < 24800) {

        simulatedPrice =
            24800;
    }

    if (simulatedPrice > 25400) {

        simulatedPrice =
            25400;
    }

    return simulatedPrice;
}


// ------------------------------------------
// SIMULATION TICK
// ------------------------------------------

function simulationTick() {

    // Advance simulated time
    // 10 seconds per tick

    simulatedTime =
        new Date(
            simulatedTime.getTime() +
            10000
        );


    const price =
        generatePrice();


    processTick(
        price,
        simulatedTime.getTime()
    );


    updateTerminal();
}


// ------------------------------------------
// CANVAS RESIZE
// ------------------------------------------

function resizeCanvas() {

    if (!canvas || !ctx) {
        return;
    }

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


// ------------------------------------------
// DRAW CHART
// ------------------------------------------

function drawChart() {

    if (!canvas || !ctx) {
        return;
    }

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


    const data =
        getDisplayCandles();

    if (data.length === 0) {
        return;
    }


    // Last 60 candles

    const visible =
        data.slice(-60);


    let minPrice =
        Infinity;

    let maxPrice =
        -Infinity;


    visible.forEach(candle => {

        minPrice =
            Math.min(
                minPrice,
                candle.low
            );

        maxPrice =
            Math.max(
                maxPrice,
                candle.high
            );
    });


    const range =
        maxPrice - minPrice || 1;


    const padding = 20;


    const chartHeight =
        height -
        padding * 2;


    const candleSlot =
        (width - padding * 2) /
        visible.length;


    const candleWidth =
        Math.max(
            3,
            candleSlot * 0.65
        );


    // --------------------------------------
    // NORMAL CANDLES
    // --------------------------------------

    visible.forEach(
        (candle, index) => {

            const x =
                padding +
                index * candleSlot +
                candleSlot / 2;


            const openY =
                padding +
                (maxPrice - candle.open) /
                range *
                chartHeight;


            const closeY =
                padding +
                (maxPrice - candle.close) /
                range *
                chartHeight;


            const highY =
                padding +
                (maxPrice - candle.high) /
                range *
                chartHeight;


            const lowY =
                padding +
                (maxPrice - candle.low) /
                range *
                chartHeight;


            const bullish =
                candle.close >=
                candle.open;


            // WICK

            ctx.beginPath();

            ctx.moveTo(
                x,
                highY
            );

            ctx.lineTo(
                x,
                lowY
            );

            ctx.strokeStyle =
                bullish
                    ? "#22c55e"
                    : "#ef4444";

            ctx.lineWidth = 1;

            ctx.stroke();


            // BODY

            const bodyTop =
                Math.min(
                    openY,
                    closeY
                );


            const bodyBottom =
                Math.max(
                    openY,
                    closeY
                );


            const bodyHeight =
                Math.max(
                    1,
                    bodyBottom -
                    bodyTop
                );


            ctx.fillStyle =
                bullish
                    ? "#22c55e"
                    : "#ef4444";


            ctx.fillRect(
                x -
                candleWidth / 2,

                bodyTop,

                candleWidth,

                bodyHeight
            );
        }
    );


    // --------------------------------------
    // V CANDLE OVERLAY
    // --------------------------------------

    if (
        typeof calculateVCandle ===
        "function"
    ) {

        const vData =
            calculateVCandle(
                data,
                SETTINGS.vCandleSmooth,
                SETTINGS.vCandleAfter,
                SETTINGS.vCandleDoji
            );


        const visibleV =
            vData.slice(-60);


        visibleV.forEach(
            (v, index) => {

                if (
                    v.open == null ||
                    v.high == null ||
                    v.low == null ||
                    v.close == null
                ) {
                    return;
                }


                const x =
                    padding +
                    index * candleSlot +
                    candleSlot / 2;


                const openY =
                    padding +
                    (maxPrice - v.open) /
                    range *
                    chartHeight;


                const closeY =
                    padding +
                    (maxPrice - v.close) /
                    range *
                    chartHeight;


                const highY =
                    padding +
                    (maxPrice - v.high) /
                    range *
                    chartHeight;


                const lowY =
                    padding +
                    (maxPrice - v.low) /
                    range *
                    chartHeight;


                // V CANDLE COLOR

                let color;


                if (v.isDoji) {

                    color =
                        "#888888";

                } else if (
                    v.color ===
                    "bullish"
                ) {

                    color =
                        "#86efac";

                } else {

                    color =
                        "#fca5a5";
                }


                // V WICK

                ctx.beginPath();

                ctx.moveTo(
                    x,
                    highY
                );

                ctx.lineTo(
                    x,
                    lowY
                );

                ctx.strokeStyle =
                    color;

                ctx.lineWidth = 2;

                ctx.stroke();


                // V BODY

                const bodyTop =
                    Math.min(
                        openY,
                        closeY
                    );


                const bodyBottom =
                    Math.max(
                        openY,
                        closeY
                    );


                const bodyHeight =
                    Math.max(
                        2,
                        bodyBottom -
                        bodyTop
                    );


                ctx.fillStyle =
                    color;


                ctx.fillRect(
                    x -
                    candleWidth / 2,

                    bodyTop,

                    candleWidth,

                    bodyHeight
                );
            }
        );
    }
}


// ------------------------------------------
// CONNECTION STATUS
// ------------------------------------------

if (connectionElement) {

    connectionElement.textContent =
        "SIMULATION";
}


// ------------------------------------------
// SYMBOL
// ------------------------------------------

if (symbolElement) {

    symbolElement.textContent =
        SETTINGS.symbol;
}


// ------------------------------------------
// WINDOW RESIZE
// ------------------------------------------

window.addEventListener(
    "resize",
    resizeCanvas
);


// ------------------------------------------
// INITIAL CANVAS
// ------------------------------------------

resizeCanvas();


// ------------------------------------------
// START SIMULATION
// ------------------------------------------

setInterval(
    simulationTick,
    500
);


// First tick
simulationTick();
