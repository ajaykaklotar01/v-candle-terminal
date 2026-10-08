// ==========================================
// V CANDLE TERMINAL
// PROFESSIONAL CHART UI V1
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
// MARKET DATA
// ==========================================

let candles = [];

let currentPrice = 25150;

let simulatedTime =
    Date.now() - (150 * 3 * 60 * 1000);


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
        Math.max(open, close)
        + Math.random() * 12;

    const low =
        Math.min(open, close)
        - Math.random() * 12;

    currentPrice =
        close;

    const candle = {

        time: new Date(simulatedTime),

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
// INITIAL HISTORY
// ==========================================

function generateInitialHistory() {

    candles = [];

    currentPrice = 25150;

    simulatedTime =
        Date.now() -
        (150 *
        SETTINGS.timeframeMinutes *
        60 *
        1000);

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
// UI UPDATE
// ==========================================

function updateMarketUI() {

    const last =
        candles[candles.length - 1];

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
        formatTime(last.time);

}


// ==========================================
// TIME FORMAT
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
        values[values.length - 1];

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
        values[values.length - 1];

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
        result.slDistance.toFixed(2)
        +
        " / "
        +
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
// DRAW MAIN CHART
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


    // BACKGROUND

    chartCtx.fillStyle =
        "#101318";

    chartCtx.fillRect(
        0,
        0,
        width,
        height
    );


    const visibleCount =
        Math.min(70, candles.length);

    const visibleCandles =
        candles.slice(
            candles.length - visibleCount
        );


    const visibleV =
        vcandles
            ? vcandles.slice(
                vcandles.length - visibleCount
            )
            : [];


    let min =
        Infinity;

    let max =
        -Infinity;


    visibleCandles.forEach(c => {

        min =
            Math.min(
                min,
                c.low
            );

        max =
            Math.max(
                max,
                c.high
            );

    });


    visibleV.forEach(c => {

        if (c) {

            min =
                Math.min(
                    min,
                    c.low
                );

            max =
                Math.max(
                    max,
                    c.high
                );

        }

    });


    const padding =
        (max - min) * 0.12;

    min -= padding;
    max += padding;


    const chartLeft = 10;
    const chartRight = 65;
    const chartTop = 18;
    const chartBottom = 28;

    const chartWidth =
        width -
        chartLeft -
        chartRight;

    const chartHeight =
        height -
        chartTop -
        chartBottom;


    // GRID

    chartCtx.strokeStyle =
        "#22262d";

    chartCtx.lineWidth = 1;


    for (
        let i = 0;
        i <= 6;
        i++
    ) {

        const y =
            chartTop +
            (chartHeight / 6) * i;

        chartCtx.beginPath();

        chartCtx.moveTo(
            chartLeft,
            y
        );

        chartCtx.lineTo(
            chartLeft + chartWidth,
            y
        );

        chartCtx.stroke();


        const price =
            max -
            ((max - min) *
            i / 6);

        chartCtx.fillStyle =
            "#727985";

        chartCtx.font =
            "10px Arial";

        chartCtx.fillText(
            price.toFixed(2),
            width - 58,
            y + 3
        );

    }


    // CANDLE WIDTH

    const step =
        chartWidth /
        visibleCount;

    const candleWidth =
        Math.max(
            3,
            step * 0.55
        );


    function priceToY(price) {

        return chartTop +
            ((max - price) /
            (max - min)) *
            chartHeight;

    }


    // NORMAL OHLC CANDLES

    visibleCandles.forEach(
        (candle, index) => {

            const x =
                chartLeft +
                step * index +
                step / 2;

            const openY =
                priceToY(candle.open);

            const closeY =
                priceToY(candle.close);

            const highY =
                priceToY(candle.high);

            const lowY =
                priceToY(candle.low);


            const bullish =
                candle.close >=
                candle.open;


            chartCtx.strokeStyle =
                bullish
                    ? "#43c982"
                    : "#e05b63";

            chartCtx.fillStyle =
                bullish
                    ? "#43c982"
                    : "#e05b63";


            // WICK

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


            // BODY

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

            chartCtx.fillRect(
                x -
                candleWidth / 2,
                bodyTop,
                candleWidth,
                bodyHeight
            );

        }
    );


    // V CANDLE OVERLAY

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
                priceToY(candle.open);

            const closeY =
                priceToY(candle.close);

            const highY =
                priceToY(candle.high);

            const lowY =
                priceToY(candle.low);


            let color;

            if (candle.isDoji) {

                color =
                    "#8d939c";

            } else if (
                candle.close >=
                candle.open
            ) {

                color =
                    "#9be7b7";

            } else {

                color =
                    "#ee9298";

            }


            chartCtx.strokeStyle =
                color;

            chartCtx.fillStyle =
                color;


            // V WICK

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


            // V BODY

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


            chartCtx.globalAlpha =
                0.62;


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


    // CURRENT PRICE LINE

    const last =
        candles[candles.length - 1];

    if (last) {

        const y =
            priceToY(last.close);

        chartCtx.strokeStyle =
            "#707782";

        chartCtx.setLineDash(
            [5, 4]
        );

        chartCtx.beginPath();

        chartCtx.moveTo(
            chartLeft,
            y
        );

        chartCtx.lineTo(
            chartLeft + chartWidth,
            y
        );

        chartCtx.stroke();

        chartCtx.setLineDash([]);


        // PRICE LABEL

        chartCtx.fillStyle =
            "#20252c";

        chartCtx.fillRect(
            width - 62,
            y - 9,
            60,
            18
        );

        chartCtx.fillStyle =
            "#e5e8ed";

        chartCtx.font =
            "10px Arial";

        chartCtx.fillText(
            last.close.toFixed(2),
            width - 58,
            y + 4
        );

    }


    // TIME LABELS

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
            formatTime(candle.time),
            x - 17,
            height - 8
        );

    }

}


// ==========================================
// DRAW V SLOPE
// ==========================================

function drawSlopeChart(
    slopeValues
) {

    const rect =
        slopeCanvas.getBoundingClientRect();

    const width =
        rect.width;

    const height =
        rect.height;

    slopeCtx.clearRect(
        0,
        0,
        width,
        height
    );


    slopeCtx.fillStyle =
        "#101318";

    slopeCtx.fillRect(
        0,
        0,
        width,
        height
    );


    if (
        !slopeValues ||
        slopeValues.length === 0
    ) {
        return;
    }


    const visibleCount =
        Math.min(
            70,
            slopeValues.length
        );

    const values =
        slopeValues.slice(
            slopeValues.length -
            visibleCount
        );


    const left = 10;
    const right = 65;
    const top = 12;
    const bottom = 12;

    const plotWidth =
        width -
        left -
        right;

    const plotHeight =
        height -
        top -
        bottom;


    const neutral =
        SETTINGS.vSlope.neutralZone;


    let min =
        -0.10;

    let max =
        0.10;


    values.forEach(v => {

        if (
            v.value != null
        ) {

            min =
                Math.min(
                    min,
                    v.value
                );

            max =
                Math.max(
                    max,
                    v.value
                );

        }

    });


    const range =
        Math.max(
            0.10,
            max - min
        );

    const center =
        (max + min) / 2;

    min =
        center -
        range * 0.65;

    max =
        center +
        range * 0.65;


    function valueToY(value) {

        return top +
            ((max - value) /
            (max - min)) *
            plotHeight;

    }


    // GRID / ZONES

    const levels = [
        {
            value: neutral,
            label: "+0.03"
        },
        {
            value: 0,
            label: "0"
        },
        {
            value: -neutral,
            label: "-0.03"
        }
    ];


    levels.forEach(
        level => {

            const y =
                valueToY(
                    level.value
                );


            slopeCtx.strokeStyle =
                "#30353d";

            slopeCtx.setLineDash(
                [5, 4]
            );

            slopeCtx.beginPath();

            slopeCtx.moveTo(
                left,
                y
            );

            slopeCtx.lineTo(
                left + plotWidth,
                y
            );

            slopeCtx.stroke();

            slopeCtx.setLineDash([]);


            slopeCtx.fillStyle =
                "#737a85";

            slopeCtx.font =
                "9px Arial";

            slopeCtx.fillText(
                level.label,
                width - 48,
                y + 3
            );

        }
    );


    // SLOPE LINE

    const step =
        plotWidth /
        Math.max(
            1,
            visibleCount - 1
        );


    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        const previous =
            values[i - 1];

        const current =
            values[i];


        if (
            previous.value == null ||
            current.value == null
        ) {
            continue;
        }


        const x1 =
            left +
            step * (i - 1);

        const x2 =
            left +
            step * i;


        const y1 =
            valueToY(
                previous.value
            );

        const y2 =
            valueToY(
                current.value
            );


        let color =
            "#6e8ee8";


        if (
            current.state ===
            "BULLISH"
        ) {

            color =
                "#43c982";

        } else if (
            current.state ===
            "BEARISH"
        ) {

            color =
                "#e05b63";

        } else {

            color =
                "#6e8ee8";

        }


        slopeCtx.strokeStyle =
            color;

        slopeCtx.lineWidth = 2;


        slopeCtx.beginPath();

        slopeCtx.moveTo(
            x1,
            y1
        );

        slopeCtx.lineTo(
            x2,
            y2
        );

        slopeCtx.stroke();

    }


    slopeCtx.lineWidth = 1;

}


// ==========================================
// DRAW BOTH
// ==========================================

function drawCharts() {

    const vcandles =
        calculateVCandle(
            candles,
            SETTINGS.vCandle.smoothLen,
            SETTINGS.vCandle.afterLen,
            SETTINGS.vCandle.dojiThreshold
        );


    const slope =
        calculateVSlope(
            candles,
            SETTINGS.vSlope.smoothLen,
            SETTINGS.vSlope.afterLen,
            SETTINGS.vSlope.slopeEMA,
            SETTINGS.vSlope.neutralZone
        );


    drawMainChart(
        vcandles
    );

    drawSlopeChart(
        slope
    );

}


// ==========================================
// UPDATE EVERYTHING
// ==========================================

function updateTerminal() {

    updateMarketUI();

    updateVCandle();

    updateVSlope();

    updateVLOT();

    drawCharts();

}


// ==========================================
// NEW SIMULATED CANDLE
// ==========================================

function addNewCandle() {

    candles.push(
        createSimulatedCandle()
    );


    if (
        candles.length > 300
    ) {

        candles.shift();

    }


    updateTerminal();

}


// ==========================================
// START
// ==========================================

generateInitialHistory();


// Give browser time to calculate dimensions.

setTimeout(
    () => {

        resizeAll();

        updateTerminal();

    },
    100
);


// Simulation tick.

setInterval(
    () => {

        addNewCandle();

    },
    1500
);


// ==========================================
// V1.1 CROSSHAIR + OHLC TOOLTIP
// ==========================================

let crosshairActive = false;
let crosshairX = 0;
let crosshairY = 0;
let crosshairCandleIndex = -1;


// ==========================================
// TOOLTIP
// ==========================================

function showChartTooltip(
    candleIndex,
    x,
    y
) {

    let tooltip =
        document.querySelector(
            ".chart-tooltip"
        );


    if (!tooltip) {

        tooltip =
            document.createElement(
                "div"
            );

        tooltip.className =
            "chart-tooltip";


        document.querySelector(
            ".main-chart"
        ).appendChild(
            tooltip
        );

    }


    const candle =
        candles[candleIndex];


    if (!candle) {
        return;
    }


    // Calculate V Candle again
    const vcandles =
        calculateVCandle(
            candles,
            SETTINGS.vCandle.smoothLen,
            SETTINGS.vCandle.afterLen,
            SETTINGS.vCandle.dojiThreshold
        );


    const v =
        vcandles[candleIndex];


    tooltip.innerHTML = `

        <div class="tooltip-time">
            ${formatTime(candle.time)}
        </div>

        <div class="tooltip-row">
            <span>Open</span>
            <strong>${candle.open.toFixed(2)}</strong>
        </div>

        <div class="tooltip-row">
            <span>High</span>
            <strong>${candle.high.toFixed(2)}</strong>
        </div>

        <div class="tooltip-row">
            <span>Low</span>
            <strong>${candle.low.toFixed(2)}</strong>
        </div>

        <div class="tooltip-row">
            <span>Close</span>
            <strong>${candle.close.toFixed(2)}</strong>
        </div>

        ${
            v
                ? `
                <div class="tooltip-row">
                    <span>V Close</span>
                    <strong>${v.close.toFixed(2)}</strong>
                </div>
                `
                : ""
        }

    `;


    tooltip.style.display =
        "block";


    const chart =
        document.querySelector(
            ".main-chart"
        );


    const chartWidth =
        chart.clientWidth;


    const tooltipWidth =
        tooltip.offsetWidth;


    let left =
        x + 14;


    // Prevent tooltip going outside right side

    if (
        left +
        tooltipWidth >
        chartWidth -
        5
    ) {

        left =
            x -
            tooltipWidth -
            14;

    }


    tooltip.style.left =
        Math.max(
            5,
            left
        ) + "px";


    tooltip.style.top =
        Math.max(
            5,
            y + 12
        ) + "px";

}


// ==========================================
// HIDE TOOLTIP
// ==========================================

function hideChartTooltip() {

    const tooltip =
        document.querySelector(
            ".chart-tooltip"
        );


    if (tooltip) {

        tooltip.style.display =
            "none";

    }

}


// ==========================================
// DRAW CROSSHAIR
// ==========================================

function drawCrosshair() {

    if (!crosshairActive) {
        return;
    }


    const rect =
        chartCanvas.getBoundingClientRect();


    const width =
        rect.width;

    const height =
        rect.height;


    const chartLeft = 10;
    const chartRight = 65;
    const chartTop = 18;
    const chartBottom = 28;


    const chartWidth =
        width -
        chartLeft -
        chartRight;


    const chartHeight =
        height -
        chartTop -
        chartBottom;


    chartCtx.strokeStyle =
        "#737b86";


    chartCtx.lineWidth = 1;


    chartCtx.setLineDash(
        [4, 4]
    );


    // Vertical line

    chartCtx.beginPath();

    chartCtx.moveTo(
        crosshairX,
        chartTop
    );

    chartCtx.lineTo(
        crosshairX,
        chartTop +
        chartHeight
    );

    chartCtx.stroke();


    // Horizontal line

    chartCtx.beginPath();

    chartCtx.moveTo(
        chartLeft,
        crosshairY
    );

    chartCtx.lineTo(
        chartLeft +
        chartWidth,
        crosshairY
    );

    chartCtx.stroke();


    chartCtx.setLineDash([]);


    chartCtx.lineWidth = 1;

}


// ==========================================
// MOUSE / TOUCH MOVE
// ==========================================

function handleChartPointerMove(event) {

    const rect =
        chartCanvas.getBoundingClientRect();


    const x =
        event.clientX -
        rect.left;


    const y =
        event.clientY -
        rect.top;


    const visibleCount =
        Math.min(
            70,
            candles.length
        );


    const chartLeft = 10;
    const chartRight = 65;


    const chartWidth =
        rect.width -
        chartLeft -
        chartRight;


    const step =
        chartWidth /
        visibleCount;


    const relativeX =
        x -
        chartLeft;


    // Outside chart

    if (
        relativeX < 0 ||
        relativeX > chartWidth
    ) {

        crosshairActive =
            false;


        hideChartTooltip();


        drawCharts();


        return;

    }


    let visibleIndex =
        Math.floor(
            relativeX /
            step
        );


    visibleIndex =
        Math.max(
            0,
            Math.min(
                visibleCount - 1,
                visibleIndex
            )
        );


    const actualIndex =
        candles.length -
        visibleCount +
        visibleIndex;


    crosshairActive =
        true;


    crosshairX =
        chartLeft +
        visibleIndex *
        step +
        step / 2;


    crosshairY =
        y;


    crosshairCandleIndex =
        actualIndex;


    drawCharts();


    drawCrosshair();


    showChartTooltip(
        actualIndex,
        crosshairX,
        crosshairY
    );

}


// ==========================================
// POINTER MOVE
// ==========================================

chartCanvas.addEventListener(
    "pointermove",
    handleChartPointerMove
);


// ==========================================
// POINTER LEAVE
// ==========================================

chartCanvas.addEventListener(
    "pointerleave",
    () => {

        crosshairActive =
            false;

        crosshairCandleIndex =
            -1;

        hideChartTooltip();

        drawCharts();

    }
);
