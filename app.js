/*
    V CANDLE TERMINAL
    PHASE 1

    Current:
    - Simulated OHLC data
    - 3-minute candles
    - Candlestick chart

    Later:
    - FYERS WebSocket
    - Real-time data
    - V Candle V2
    - V Slope
    - VLOT
*/


const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

const priceElement = document.getElementById("price");
const statusElement = document.getElementById("status");
const lastTimeElement = document.getElementById("lastTime");

const symbolElement = document.getElementById("symbol");
const chartSymbol = document.getElementById("chartSymbol");


// --------------------------------------------------
// SAMPLE 3-MINUTE OHLC DATA
// --------------------------------------------------

let candles = [
    { time: "13:00", open: 25100, high: 25135, low: 25080, close: 25120 },
    { time: "13:03", open: 25120, high: 25170, low: 25105, close: 25155 },
    { time: "13:06", open: 25155, high: 25190, low: 25130, close: 25140 },
    { time: "13:09", open: 25140, high: 25160, low: 25095, close: 25110 },
    { time: "13:12", open: 25110, high: 25145, low: 25070, close: 25085 },
    { time: "13:15", open: 25085, high: 25125, low: 25060, close: 25115 },
    { time: "13:18", open: 25115, high: 25180, low: 25100, close: 25170 },
    { time: "13:21", open: 25170, high: 25210, low: 25145, close: 25200 },
    { time: "13:24", open: 25200, high: 25235, low: 25170, close: 25190 },
    { time: "13:27", open: 25190, high: 25220, low: 25150, close: 25165 },
    { time: "13:30", open: 25165, high: 25200, low: 25125, close: 25140 },
    { time: "13:33", open: 25140, high: 25175, low: 25110, close: 25170 },
    { time: "13:36", open: 25170, high: 25240, low: 25160, close: 25230 },
    { time: "13:39", open: 25230, high: 25270, low: 25205, close: 25255 },
    { time: "13:42", open: 25255, high: 25290, low: 25220, close: 25235 },
    { time: "13:45", open: 25235, high: 25260, low: 25190, close: 25205 },
    { time: "13:48", open: 25205, high: 25240, low: 25170, close: 25185 },
    { time: "13:51", open: 25185, high: 25230, low: 25160, close: 25215 },
    { time: "13:54", open: 25215, high: 25265, low: 25200, close: 25250 },
    { time: "13:57", open: 25250, high: 25290, low: 25230, close: 25275 }
];


// --------------------------------------------------
// RESIZE CANVAS
// --------------------------------------------------

function resizeCanvas() {

    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;

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

window.addEventListener("resize", resizeCanvas);


// --------------------------------------------------
// DRAW CHART
// --------------------------------------------------

function drawChart() {

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);


    if (candles.length === 0) {
        return;
    }


    // Find price range

    let highest = Math.max(...candles.map(c => c.high));
    let lowest = Math.min(...candles.map(c => c.low));

    const padding = (highest - lowest) * 0.12;

    highest += padding;
    lowest -= padding;


    function y(price) {

        return height -
            ((price - lowest) / (highest - lowest)) *
            height;
    }


    // Grid

    ctx.strokeStyle = "#20242a";
    ctx.lineWidth = 1;

    for (let i = 1; i < 6; i++) {

        const gy = height * i / 6;

        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
    }


    // Candle dimensions

    const spacing = width / candles.length;
    const candleWidth = Math.max(4, spacing * 0.55);


    candles.forEach((candle, index) => {

        const x = spacing * index + spacing / 2;

        const openY = y(candle.open);
        const closeY = y(candle.close);
        const highY = y(candle.high);
        const lowY = y(candle.low);


        const bullish = candle.close >= candle.open;


        // Wick

        ctx.strokeStyle = bullish
            ? "#35d07f"
            : "#ff5f56";

        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);

        ctx.stroke();


        // Body

        const bodyTop = Math.min(openY, closeY);

        const bodyHeight = Math.max(
            2,
            Math.abs(openY - closeY)
        );


        ctx.fillStyle = bullish
            ? "#35d07f"
            : "#ff5f56";


        ctx.fillRect(
            x - candleWidth / 2,
            bodyTop,
            candleWidth,
            bodyHeight
        );

    });


    // Last price line

    const last = candles[candles.length - 1];

    const lastY = y(last.close);

    ctx.strokeStyle = "#777";
    ctx.setLineDash([4, 4]);

    ctx.beginPath();

    ctx.moveTo(0, lastY);
    ctx.lineTo(width, lastY);

    ctx.stroke();

    ctx.setLineDash([]);


    // Price label

    ctx.fillStyle = "#ddd";
    ctx.font = "11px Arial";

    ctx.fillText(
        last.close.toFixed(2),
        8,
        Math.max(14, lastY - 5)
    );
}


// --------------------------------------------------
// TERMINAL UPDATE
// --------------------------------------------------

function updateTerminal() {

    const last = candles[candles.length - 1];

    if (!last) {
        return;
    }


    priceElement.textContent =
        last.close.toFixed(2);


    lastTimeElement.textContent =
        last.time;


    statusElement.textContent =
        "SIMULATION";


    // Temporary placeholder values

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


// --------------------------------------------------
// SYMBOL CHANGE
// --------------------------------------------------

symbolElement.addEventListener(
    "change",
    function () {

        chartSymbol.textContent =
            symbolElement.value;

    }
);


// --------------------------------------------------
// START
// --------------------------------------------------

resizeCanvas();

updateTerminal();

console.log(
    "V CANDLE TERMINAL - PHASE 1 READY"
);
