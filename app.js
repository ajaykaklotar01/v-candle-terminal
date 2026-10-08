// ==========================================
// V CANDLE TERMINAL
// PROFESSIONAL CHART V2
// ==========================================


// ==========================================
// SETTINGS
// ==========================================

const SETTINGS = {

    symbol: "NIFTY 50",

    timeframeMinutes: 3,

    vCandle: {
        smoothLen: 45,
        afterLen: 45,
        dojiThreshold: 0.03
    },

    vSlope: {
        smoothLen: 60,
        afterLen: 60,
        slopeEMA: 5,
        neutralZone: 0.03
    },

    vlot: {
        atrLength: 14,
        atrMultiplier: 1.3,
        risk: 5,
        sldMode: "AUTO ATR",
        manualSLD: 10
    }

};


// ==========================================
// DATA
// ==========================================

let candles = [];

let currentPrice = 25150;

let simulatedTime =
    Date.now() -
    (150 * 3 * 60 * 1000);


// ==========================================
// CHART STATE
// ==========================================

let crosshair = {

    active: false,

    x: 0,

    y: 0,

    candleIndex: -1

};


// ==========================================
// CANVAS
// ==========================================

const chartCanvas =
    document.getElementById("chart");

const slopeCanvas =
    document.getElementById("slopeChart");

const chartCtx =
    chartCanvas.getContext("2d");

const slopeCtx =
    slopeCanvas.getContext("2d");


// ==========================================
// CANVAS RESIZE
// ==========================================

function resizeCanvas(canvas, ctx) {

    const rect =
        canvas.getBoundingClientRect();

    const dpr =
        window.devicePixelRatio || 1;

    canvas.width =
        rect.width * dpr;

    canvas.height =
        rect.height * dpr;

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

}


function resizeAll() {

    resizeCanvas(
        chartCanvas,
        chartCtx
    );

    resizeCanvas(
        slopeCanvas,
        slopeCtx
    );

    drawCharts();

}


window.addEventListener(
    "resize",
    resizeAll
);


// ==========================================
// SIMULATED CANDLE
// ==========================================

function createSimulatedCandle() {

    const open =
        currentPrice;

    const movement =
        (Math.random() - 0.5) * 35;

    const close =
        open + movement;

    const high =
        Math.max(
            open,
            close
        ) +
        Math.random() * 12;

    const low =
        Math.min(
            open,
            close
        ) -
        Math.random() * 12;

    currentPrice =
        close;

    const candle = {

        time:
            new Date(
                simulatedTime
            ),

        open: open,

        high: high,

        low: low,

        close: close

    };

    simulatedTime +=
        SETTINGS.timeframeMinutes *
        60 *
        1000;

    return candle;

}


// ==========================================
// HISTORY
// ==========================================

function generateInitialHistory() {

    candles = [];

    currentPrice = 25150;

    simulatedTime =
        Date.now() -
        (
            150 *
            SETTINGS.timeframeMinutes *
            60 *
            1000
        );


    for (
        let i = 0;
        i < 150;
        i++
    ) {

        candles.push(
            createSimulatedCandle()
        );

    }

}


// ==========================================
// TIME
// ==========================================

function formatTime(date) {

    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    );

}


// ==========================================
// MARKET UI
// ==========================================

function updateMarketUI() {

    const last =
        candles[
            candles.length - 1
        ];

    if (!last) {
        return;
    }


    document.getElementById(
        "price"
    ).textContent =
        last.close.toFixed(2);


    document.getElementById(
        "chartSymbol"
    ).textContent =
        SETTINGS.symbol;


    document.getElementById(
        "status"
    ).textContent =
        "RUNNING";


    document.getElementById(
        "lastTime"
    ).textContent =
        formatTime(
            last.time
        );

}


// ==========================================
// V CANDLE
// ==========================================

function updateVCandle() {

    const values =
        calculateVCandle(
            candles,
            SETTINGS.vCandle.smoothLen,
            SETTINGS.vCandle.afterLen,
            SETTINGS.vCandle.dojiThreshold
        );


    if (!values.length) {
        return null;
    }


    const last =
        values[
            values.length - 1
        ];


    const signal =
        last.isDoji
            ? "DOJI"
            : last.close >= last.open
                ? "BULLISH"
                : "BEARISH";


    document.getElementById(
        "vCandleSignal"
    ).textContent =
        signal;


    document.getElementById(
        "vCandleValue"
    ).textContent =
        last.close.toFixed(2);


    return values;

}


// ==========================================
// V SLOPE
// ==========================================

function updateVSlope() {

    const values =
        calculateVSlope(
            candles,
            SETTINGS.vSlope.smoothLen,
            SETTINGS.vSlope.afterLen,
            SETTINGS.vSlope.slopeEMA,
            SETTINGS.vSlope.neutralZone
        );


    if (!values.length) {
        return null;
    }


    const last =
        values[
            values.length - 1
        ];


    const value =
        last.value == null
            ? 0
            : last.value;


    const signal =
        last.state;


    document.getElementById(
        "vSlopeValue"
    ).textContent =
        value.toFixed(4);


    document.getElementById(
        "vSlopeSignal"
    ).textContent =
        signal;


    document.getElementById(
        "vSlopeCardValue"
    ).textContent =
        value.toFixed(4);


    document.getElementById(
        "vSlopeSignalCard"
    ).textContent =
        signal;


    return values;

}


// ==========================================
// VLOT
// ==========================================

function updateVLOT() {

    const result =
        calculateVLOT(
            candles,
            SETTINGS.vlot.atrLength,
            SETTINGS.vlot.atrMultiplier,
            SETTINGS.vlot.risk,
            SETTINGS.vlot.sldMode,
            SETTINGS.vlot.manualSLD
        );


    if (!result) {
        return null;
    }


    if (result.atr == null) {
        return result;
    }


    document.getElementById(
        "vlotRisk"
    ).textContent =
        "$" +
        result.risk.toFixed(2);


    document.getElementById(
        "vlotATR"
    ).textContent =
        result.atr.toFixed(2);


    document.getElementById(
        "vlotSLD"
    ).textContent =
        "$" +
        result.slDistance.toFixed(2);


    document.getElementById(
        "vlotLOT"
    ).textContent =
        result.lotSize.toFixed(2);


    document.getElementById(
        "vlotValue"
    ).textContent =
        "$" +
        result.slDistance.toFixed(2) +
        " / " +
        result.lotSize.toFixed(2);


    document.getElementById(
        "vlotSignal"
    ).textContent =
        "READY";


    document.getElementById(
        "vlotSignalCard"
    ).textContent =
        "READY";


    return result;

}


// ==========================================
// MAIN CHART
// ==========================================

function drawMainChart(
    vcandles
) {

    const rect =
        chartCanvas.getBoundingClientRect();

    const width =
        rect.width;

    const height =
        rect.height;


    chartCtx.clearRect(
        0,
        0,
        width,
        height
    );


    chartCtx.fillStyle =
        "#101318";

    chartCtx.fillRect(
        0,
        0,
        width,
        height
    );


    const visibleCount =
        Math.min(
            70,
            candles.length
        );


    const visibleCandles =
        candles.slice(
            candles.length -
            visibleCount
        );


    const visibleV =
        vcandles
            ? vcandles.slice(
                vcandles.length -
                visibleCount
            )
            : [];


    let min =
        Infinity;

    let max =
        -Infinity;


    visibleCandles.forEach(
        candle => {

            min =
                Math.min(
                    min,
                    candle.low
                );

            max =
                Math.max(
                    max,
                    candle.high
                );

        }
    );


    visibleV.forEach(
        candle => {

            if (!candle) {
                return;
            }

            min =
                Math.min(
                    min,
                    candle.low
                );

            max =
                Math.max(
                    max,
                    candle.high
                );

        }
    );


    const range =
        max - min || 1;


    const padding =
        range * 0.12;


    min -= padding;
    max += padding;


    const chartLeft = 12;
    const chartRight = 68;
    const chartTop = 18;
    const chartBottom = 30;


    const chartWidth =
        width -
        chartLeft -
        chartRight;


    const chartHeight =
        height -
        chartTop -
        chartBottom;


    function priceToY(price) {

        return chartTop +
            (
                (max - price) /
                (max - min)
            ) *
            chartHeight;

    }


    // ======================================
    // GRID
    // ======================================

    chartCtx.lineWidth = 1;

    chartCtx.font =
        "10px Arial";


    for (
        let i = 0;
        i <= 6;
        i++
    ) {

        const y =
            chartTop +
            (
                chartHeight /
                6
            ) * i;


        chartCtx.strokeStyle =
            "#22262d";


        chartCtx.beginPath();

        chartCtx.moveTo(
            chartLeft,
            y
        );

        chartCtx.lineTo(
            chartLeft +
            chartWidth,
            y
        );

        chartCtx.stroke();


        const price =
            max -
            (
                (max - min) *
                i /
                6
            );


        chartCtx.fillStyle =
            "#727985";


        chartCtx.fillText(
            price.toFixed(2),
            width - 61,
            y + 3
        );

    }


    // ======================================
    // CANDLE DIMENSIONS
    // ======================================

    const step =
        chartWidth /
        visibleCount;


    const candleWidth =
        Math.max(
            3,
            Math.min(
                12,
                step * 0.58
            )
        );


    // ======================================
    // NORMAL CANDLES
    // ======================================

    visibleCandles.forEach(
        (candle, index) => {

            const x =
                chartLeft +
                step * index +
                step / 2;


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


            const bodyTop =
                Math.min(
                    openY,
                    closeY
                );


            const bodyHeight =
                Math.max(
                    1,
                    Math.abs(
                        closeY -
                        openY
                    )
                );


            chartCtx.strokeStyle =
                bullish
                    ? "#43c982"
                    : "#e05b63";


            chartCtx.fillStyle =
                bullish
                    ? "#43c982"
                    : "#e05b63";


            // wick

            chartCtx.beginPath();

            chartCtx.moveTo(
                x,
                highY
            );

            chartCtx.lineTo(
                x,
                lowY
            );

            chartCtx.stroke();


            // body

            chartCtx.fillRect(
                x -
                candleWidth / 2,
                bodyTop,
                candleWidth,
                bodyHeight
            );

        }
    );


    // ======================================
    // V CANDLE
    // ======================================

    visibleV.forEach(
        (candle, index) => {

            if (!candle) {
                return;
            }


            const x =
                chartLeft +
                step * index +
                step / 2;


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


            let color;


            if (candle.isDoji) {

                color =
                    "#a0a6ae";

            } else if (
                candle.close >=
                candle.open
            ) {

                color =
                    "#b1edc7";

            } else {

                color =
                    "#f0a0a5";

            }


            chartCtx.strokeStyle =
                color;

            chartCtx.fillStyle =
                color;


            chartCtx.globalAlpha =
                0.72;


            // V wick

            chartCtx.beginPath();

            chartCtx.moveTo(
                x,
                highY
            );

            chartCtx.lineTo(
                x,
                lowY
            );

            chartCtx.stroke();


            // V body

            const bodyTop =
                Math.min(
                    openY,
                    closeY
                );


            const bodyHeight =
                Math.max(
                    2,
                    Math.abs(
                        closeY -
                        openY
                    )
                );


            chartCtx.fillRect(
                x -
                candleWidth * 0.32,
                bodyTop,
                candleWidth * 0.64,
                bodyHeight
            );


            chartCtx.globalAlpha =
                1;

        }
    );


    // ======================================
    // SESSION MARKERS
    // ======================================

    visibleCandles.forEach(
        (candle, index) => {

            const hours =
                candle.time.getHours();

            const minutes =
                candle.time.getMinutes();


            const totalMinutes =
                hours * 60 +
                minutes;


            const morningStart =
                13 * 60;

            const eveningStart =
                19 * 60;


            const isSessionStart =
                totalMinutes ===
                morningStart ||
                totalMinutes ===
                eveningStart;


            if (!isSessionStart) {
                return;
            }


            const x =
                chartLeft +
                step * index +
                step / 2;


            chartCtx.setLineDash(
                [6, 5]
            );


            chartCtx.strokeStyle =
                totalMinutes ===
                morningStart
                    ? "#647de8"
                    : "#d28a45";


            chartCtx.globalAlpha =
                0.6;


            chartCtx.beginPath();

            chartCtx.moveTo(
                x,
                chartTop
            );

            chartCtx.lineTo(
                x,
                chartTop +
                chartHeight
            );

            chartCtx.stroke();


            chartCtx.globalAlpha =
                1;

            chartCtx.setLineDash([]);

        }
    );


    // ======================================
    // CURRENT PRICE
    // ======================================

    const last =
        candles[
            candles.length - 1
        ];


    if (last) {

        const y =
            priceToY(
                last.close
            );


        chartCtx.strokeStyle =
            "#777e89";


        chartCtx.setLineDash(
            [5, 4]
        );


        chartCtx.beginPath();

        chartCtx.moveTo(
            chartLeft,
            y
        );

        chartCtx.lineTo(
            chartLeft +
            chartWidth,
            y
        );

        chartCtx.stroke();


        chartCtx.setLineDash([]);


        chartCtx.fillStyle =
            "#252a32";


        chartCtx.fillRect(
            width - 65,
            y - 10,
            64,
            20
        );


        chartCtx.fillStyle =
            "#e6e9ed";


        chartCtx.font =
            "10px Arial";


        chartCtx.fillText(
            last.close.toFixed(2),
            width - 61,
            y + 4
        );

    }


    // ======================================
    // TIME AXIS
    // ======================================

    chartCtx.fillStyle =
        "#6f7681";


    chartCtx.font =
        "9px Arial";


    for (
        let i = 0;
        i < visibleCount;
        i += 10
    ) {

        const candle =
            visibleCandles[i];


        if (!candle) {
            continue;
        }


        const x =
            chartLeft +
            step * i +
            step / 2;


        chartCtx.fillText(
            formatTime(
                candle.time
            ),
            x - 17,
            height - 8
        );

    }


    // ======================================
    // CROSSHAIR
    // ======================================

    if (
        crosshair.active
    ) {

        const x =
            crosshair.x;

        const y =
            crosshair.y;


        chartCtx.strokeStyle =
            "#7b838e";


        chartCtx.setLineDash(
            [4, 4]
        );


        // vertical

        chartCtx.beginPath();

        chartCtx.moveTo(
            x,
            chartTop
        );

        chartCtx.lineTo(
            x,
            chartTop +
            chartHeight
        );

        chartCtx.stroke();


        // horizontal

        chartCtx.beginPath();

        chartCtx.moveTo(
            chartLeft,
            y
        );

        chartCtx.lineTo(
            chartLeft +
            chartWidth,
            y
        );

        chartCtx.stroke();


        chartCtx.setLineDash([]);

    }


    return {

        visibleCandles,

        chartLeft,

        chartTop,

        chartWidth,

        chartHeight,

        step,

        priceToY

    };

}
