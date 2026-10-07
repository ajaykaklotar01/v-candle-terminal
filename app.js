/* =========================================================
   V CANDLE TERMINAL
   INTERACTIVE CHART ENGINE
========================================================= */


/* =========================================================
   SETTINGS
========================================================= */

const SETTINGS = {
    symbol: "NIFTY 50",
    timeframeMinutes: 3,

    initialCandles: 250,
    maxCandles: 1000,

    simulationInterval: 1500,
    startingPrice: 25100,
    candleVolatility: 18
};


/* =========================================================
   DATA
========================================================= */

let candles = [];
let lastPrice = SETTINGS.startingPrice;

let mainChart = null;
let slopeChart = null;

let priceSeries = null;
let vCandleSeries = null;
let slopeSeries = null;

let currentPriceLine = null;


/* =========================================================
   DOM
========================================================= */

const priceEl = document.getElementById("price");
const statusEl = document.getElementById("status");
const lastTimeEl = document.getElementById("lastTime");

const chartSymbolEl =
    document.getElementById("chartSymbol");

const vCandleSignalEl =
    document.getElementById("vCandleSignal");

const vCandleValueEl =
    document.getElementById("vCandleValue");

const vSlopeValueEl =
    document.getElementById("vSlopeValue");

const vSlopeSignalEl =
    document.getElementById("vSlopeSignal");

const vSlopeCardValueEl =
    document.getElementById("vSlopeCardValue");

const vSlopeSignalCardEl =
    document.getElementById("vSlopeSignalCard");

const vlotATR =
    document.getElementById("vlotATR");

const vlotSLD =
    document.getElementById("vlotSLD");

const vlotLOT =
    document.getElementById("vlotLOT");

const vlotValue =
    document.getElementById("vlotValue");

const vlotSignal =
    document.getElementById("vlotSignal");

const vlotSignalCard =
    document.getElementById("vlotSignalCard");

const ohlcOpen =
    document.getElementById("ohlcOpen");

const ohlcHigh =
    document.getElementById("ohlcHigh");

const ohlcLow =
    document.getElementById("ohlcLow");

const ohlcClose =
    document.getElementById("ohlcClose");


/* =========================================================
   HELPERS
========================================================= */

function roundPrice(value) {
    return Number(value.toFixed(2));
}


function unixSeconds(time) {
    return Math.floor(
        new Date(time).getTime() / 1000
    );
}


function formatTime(time) {

    return new Date(time).toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    );

}


/* =========================================================
   SIMULATED DATA
========================================================= */

function createInitialCandles() {

    const result = [];

    let price =
        SETTINGS.startingPrice;

    const now = Date.now();

    const interval =
        SETTINGS.timeframeMinutes *
        60 *
        1000;


    for (
        let i = SETTINGS.initialCandles;
        i > 0;
        i--
    ) {

        const time =
            new Date(
                now - i * interval
            );


        const open = price;


        const movement =
            (Math.random() - 0.5) *
            SETTINGS.candleVolatility;


        const close =
            roundPrice(
                open + movement
            );


        const high =
            roundPrice(
                Math.max(open, close) +
                Math.random() * 8
            );


        const low =
            roundPrice(
                Math.min(open, close) -
                Math.random() * 8
            );


        result.push({

            time: time.toISOString(),

            open: open,

            high: high,

            low: low,

            close: close

        });


        price = close;

    }


    lastPrice = price;

    return result;

}


/* =========================================================
   NEXT CANDLE
========================================================= */

function createNextCandle() {

    const previous =
        candles[candles.length - 1];


    const interval =
        SETTINGS.timeframeMinutes *
        60 *
        1000;


    const time =
        new Date(
            new Date(previous.time).getTime() +
            interval
        );


    const open =
        previous.close;


    const movement =
        (Math.random() - 0.5) *
        SETTINGS.candleVolatility;


    const close =
        roundPrice(
            open + movement
        );


    const high =
        roundPrice(
            Math.max(open, close) +
            Math.random() * 8
        );


    const low =
        roundPrice(
            Math.min(open, close) -
            Math.random() * 8
        );


    return {

        time: time.toISOString(),

        open: open,

        high: high,

        low: low,

        close: close

    };

}


/* =========================================================
   CHECK CHART LIBRARY
========================================================= */

function checkChartLibrary() {

    if (
        typeof LightweightCharts ===
        "undefined"
    ) {

        console.error(
            "Lightweight Charts library did not load."
        );

        statusEl.textContent =
            "CHART LIBRARY ERROR";

        return false;

    }

    return true;

}


/* =========================================================
   CREATE MAIN CHART
========================================================= */

function createMainChart() {

    const container =
        document.getElementById("chart");


    mainChart =
        LightweightCharts.createChart(
            container,
            {

                width:
                    container.clientWidth || 600,

                height:
                    container.clientHeight || 470,


                layout: {

                    background: {
                        type:
                            LightweightCharts.ColorType.Solid,

                        color:
                            "#111318"
                    },

                    textColor:
                        "#858b95",

                    fontSize:
                        11,

                    fontFamily:
                        "Inter, system-ui, sans-serif",

                    attributionLogo:
                        true
                },


                /*
                    GRID OFF
                */

                grid: {

                    vertLines: {
                        visible: false
                    },

                    horzLines: {
                        visible: false
                    }

                },


                crosshair: {

                    mode:
                        LightweightCharts.CrosshairMode.Normal,

                    vertLine: {

                        visible: true,

                        width: 1,

                        color: "#777d87",

                        style:
                            LightweightCharts.LineStyle.Dashed,

                        labelVisible: true,

                        labelBackgroundColor:
                            "#252a33"

                    },

                    horzLine: {

                        visible: true,

                        width: 1,

                        color: "#777d87",

                        style:
                            LightweightCharts.LineStyle.Dashed,

                        labelVisible: true,

                        labelBackgroundColor:
                            "#252a33"

                    }

                },


                rightPriceScale: {

                    visible: true,

                    borderVisible: false,

                    scaleMargins: {

                        top: 0.08,

                        bottom: 0.08

                    }

                },


                timeScale: {

                    visible: true,

                    borderVisible: false,

                    timeVisible: true,

                    secondsVisible: false,

                    rightOffset: 8,

                    barSpacing: 7,

                    minBarSpacing: 2

                },


                handleScroll: {

                    mouseWheel: true,

                    pressedMouseMove: true,

                    horzTouchDrag: true,

                    vertTouchDrag: true

                },


                handleScale: {

                    mouseWheel: true,

                    pinch: true,

                    axisPressedMouseMove: true,

                    axisDoubleClickReset: true

                }

            }
        );


    /*
        REAL MARKET CANDLES
    */

    priceSeries =
        mainChart.addSeries(
            LightweightCharts.CandlestickSeries,
            {

                upColor:
                    "#36b37e",

                downColor:
                    "#e05d5d",

                borderVisible:
                    false,

                wickUpColor:
                    "#36b37e",

                wickDownColor:
                    "#e05d5d"

            }
        );


    /*
        V CANDLE
    */

    vCandleSeries =
        mainChart.addSeries(
            LightweightCharts.CandlestickSeries,
            {

                upColor:
                    "rgba(54,179,126,0.22)",

                downColor:
                    "rgba(224,93,93,0.22)",

                borderUpColor:
                    "#58c493",

                borderDownColor:
                    "#e57373",

                wickUpColor:
                    "#58c493",

                wickDownColor:
                    "#e57373"

            }
        );


    /*
        CROSSHAIR
    */

    mainChart.subscribeCrosshairMove(
        function(param) {

            if (
                !param ||
                !param.time ||
                !param.seriesData
            ) {
                return;
            }


            const candle =
                param.seriesData.get(
                    priceSeries
                );


            if (!candle) {
                return;
            }


            ohlcOpen.textContent =
                Number(candle.open).toFixed(2);

            ohlcHigh.textContent =
                Number(candle.high).toFixed(2);

            ohlcLow.textContent =
                Number(candle.low).toFixed(2);

            ohlcClose.textContent =
                Number(candle.close).toFixed(2);


            if (
                typeof param.time ===
                "number"
            ) {

                const d =
                    new Date(
                        param.time * 1000
                    );

                lastTimeEl.textContent =
                    d.toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                        }
                    );

            }

        }
    );


    /*
        MOBILE / DESKTOP RESIZE
    */

    const resizeObserver =
        new ResizeObserver(
            function() {

                if (!mainChart) {
                    return;
                }

                mainChart.resize(
                    container.clientWidth,
                    container.clientHeight
                );

            }
        );


    resizeObserver.observe(
        container
    );

}


/* =========================================================
   CREATE SLOPE CHART
========================================================= */

function createSlopeChart() {

    const container =
        document.getElementById(
            "slopeChart"
        );


    slopeChart =
        LightweightCharts.createChart(
            container,
            {

                width:
                    container.clientWidth || 600,

                height:
                    container.clientHeight || 150,


                layout: {

                    background: {
                        type:
                            LightweightCharts.ColorType.Solid,

                        color:
                            "#111318"
                    },

                    textColor:
                        "#707783",

                    fontSize:
                        10,

                    fontFamily:
                        "Inter, system-ui, sans-serif",

                    attributionLogo:
                        false

                },


                grid: {

                    vertLines: {
                        visible: false
                    },

                    horzLines: {
                        visible: false
                    }

                },


                crosshair: {

                    mode:
                        LightweightCharts.CrosshairMode.Normal,

                    vertLine: {

                        visible: true,

                        width: 1,

                        color: "#777d87",

                        style:
                            LightweightCharts.LineStyle.Dashed

                    },

                    horzLine: {

                        visible: true,

                        width: 1,

                        color: "#777d87",

                        style:
                            LightweightCharts.LineStyle.Dashed

                    }

                },


                rightPriceScale: {

                    borderVisible: false,

                    scaleMargins: {

                        top: 0.15,

                        bottom: 0.15

                    }

                },


                timeScale: {

                    visible: false,

                    rightOffset: 8,

                    barSpacing: 7

                }

            }
        );


    slopeSeries =
        slopeChart.addSeries(
            LightweightCharts.LineSeries,
            {

                color:
                    "#7d8794",

                lineWidth:
                    2,

                priceLineVisible:
                    false,

                lastValueVisible:
                    true

            }
        );


    /*
        V SLOPE LEVELS
    */

    slopeSeries.createPriceLine({

        price: 0.03,

        color: "#36b37e",

        lineWidth: 1,

        lineStyle:
            LightweightCharts.LineStyle.Dashed,

        axisLabelVisible: true,

        title: "BULL"

    });


    slopeSeries.createPriceLine({

        price: -0.03,

        color: "#e05d5d",

        lineWidth: 1,

        lineStyle:
            LightweightCharts.LineStyle.Dashed,

        axisLabelVisible: true,

        title: "BEAR"

    });


    slopeSeries.createPriceLine({

        price: 0,

        color: "#777d87",

        lineWidth: 1,

        lineStyle:
            LightweightCharts.LineStyle.Dashed,

        axisLabelVisible: false

    });


    /*
        RESIZE
    */

    const resizeObserver =
        new ResizeObserver(
            function() {

                if (!slopeChart) {
                    return;
                }

                slopeChart.resize(
                    container.clientWidth,
                    container.clientHeight
                );

            }
        );


    resizeObserver.observe(
        container
    );

}


/* =========================================================
   UPDATE MAIN CHART
========================================================= */

function updateMainChart() {

    if (
        !priceSeries ||
        !vCandleSeries
    ) {
        return;
    }


    /*
        NORMAL CANDLES
    */

    const marketData =
        candles.map(
            function(c) {

                return {

                    time:
                        unixSeconds(c.time),

                    open:
                        c.open,

                    high:
                        c.high,

                    low:
                        c.low,

                    close:
                        c.close

                };

            }
        );


    priceSeries.setData(
        marketData
    );


    /*
        V CANDLE
    */

    const vc =
        calculateVCandle(
            candles,
            45,
            45,
            0.03
        );


    const vData = [];


    for (
        let i = 0;
        i < vc.length;
        i++
    ) {

        const c = vc[i];


        if (
            c.open == null ||
            c.high == null ||
            c.low == null ||
            c.close == null
        ) {
            continue;
        }


        vData.push({

            time:
                unixSeconds(c.time),

            open:
                c.open,

            high:
                c.high,

            low:
                c.low,

            close:
                c.close

        });

    }


    vCandleSeries.setData(
        vData
    );


    /*
        FIRST LOAD ONLY
    */

    if (
        !mainChart._vInitialFit
    ) {

        mainChart
            .timeScale()
            .fitContent();

        mainChart._vInitialFit =
            true;

    }


    /*
        CURRENT PRICE
    */

    if (currentPriceLine) {

        priceSeries.removePriceLine(
            currentPriceLine
        );

    }


    currentPriceLine =
        priceSeries.createPriceLine({

            price:
                lastPrice,

            color:
                "#c9cdd4",

            lineWidth:
                1,

            lineStyle:
                LightweightCharts.LineStyle.Dashed,

            axisLabelVisible:
                true,

            title:
                "PRICE"

        });


    /*
        CURRENT DATA
    */

    const last =
        candles[candles.length - 1];


    if (!last) {
        return;
    }


    priceEl.textContent =
        last.close.toFixed(2);


    ohlcOpen.textContent =
        last.open.toFixed(2);

    ohlcHigh.textContent =
        last.high.toFixed(2);

    ohlcLow.textContent =
        last.low.toFixed(2);

    ohlcClose.textContent =
        last.close.toFixed(2);


    lastTimeEl.textContent =
        formatTime(last.time);

}


/* =========================================================
   V SLOPE
========================================================= */

function updateSlopeChart() {

    if (!slopeSeries) {
        return;
    }


    const slope =
        calculateVSlope(
            candles,
            60,
            60,
            5,
            0.03
        );


    const data = [];


    for (
        let i = 0;
        i < slope.length;
        i++
    ) {

        const item =
            slope[i];


        if (
            item.value == null ||
            !Number.isFinite(item.value)
        ) {
            continue;
        }


        data.push({

            time:
                unixSeconds(item.time),

            value:
                item.value

        });

    }


    slopeSeries.setData(
        data
    );


    const last =
        slope[slope.length - 1];


    if (
        !last ||
        last.value == null
    ) {
        return;
    }


    const value =
        last.value;


    vSlopeValueEl.textContent =
        value.toFixed(4);

    vSlopeCardValueEl.textContent =
        value.toFixed(4);


    let state =
        "NEUTRAL";


    if (value > 0.03) {

        state =
            "BULLISH";

    }
    else if (value < -0.03) {

        state =
            "BEARISH";

    }


    vSlopeSignalEl.textContent =
        state;

    vSlopeSignalCardEl.textContent =
        state;

}


/* =========================================================
   VLOT
========================================================= */

function updateVLOT() {

    const result =
        calculateVLOT(
            candles,
            14,
            1.3,
            5,
            "AUTO ATR",
            10
        );


    if (!result) {
        return;
    }


    if (
        result.atr == null ||
        result.slDistance == null ||
        result.lotSize == null
    ) {
        return;
    }


    vlotATR.textContent =
        result.atr.toFixed(2);

    vlotSLD.textContent =
        "$" +
        result.slDistance.toFixed(2);

    vlotLOT.textContent =
        result.lotSize.toFixed(2);

    vlotValue.textContent =
        result.lotSize.toFixed(2);


    vlotSignal.textContent =
        "READY";

    vlotSignalCard.textContent =
        "READY";

}


/* =========================================================
   V CANDLE STATUS
========================================================= */

function updateVCandleStatus() {

    const result =
        calculateVCandle(
            candles,
            45,
            45,
            0.03
        );


    if (!result || !result.length) {
        return;
    }


    const last =
        result[result.length - 1];


    if (!last) {
        return;
    }


    const state =
        last.close >= last.open
            ? "BULLISH"
            : "BEARISH";


    vCandleSignalEl.textContent =
        state;


    vCandleValueEl.textContent =
        last.close.toFixed(2);

   }


/* =========================================================
   UPDATE TERMINAL
========================================================= */

function updateTerminal() {

    if (!candles.length) {
        return;
    }


    lastPrice =
        candles[
            candles.length - 1
        ].close;


    updateMainChart();

    updateSlopeChart();

    updateVLOT();

    updateVCandleStatus();


    statusEl.textContent =
        "RUNNING";

}


/* =========================================================
   NEW CANDLE
========================================================= */

function addNewCandle() {

    const next =
        createNextCandle();


    candles.push(next);


    if (
        candles.length >
        SETTINGS.maxCandles
    ) {

        candles.shift();

    }


    lastPrice =
        next.close;


    updateTerminal();

}


/* =========================================================
   START
========================================================= */

function startTerminal() {

    /*
        DATA FIRST
        This prevents the entire UI
        from becoming blank if the chart
        has a problem.
    */

    candles =
        createInitialCandles();


    lastPrice =
        candles[
            candles.length - 1
        ].close;


    /*
        UI DATA FIRST
    */

    chartSymbolEl.textContent =
        SETTINGS.symbol;

    priceEl.textContent =
        lastPrice.toFixed(2);

    statusEl.textContent =
        "STARTING";


    /*
        INDICATORS FIRST
    */

    try {

        updateVLOT();

        updateVCandleStatus();

        updateSlopeValuesOnly();

    }
    catch (error) {

        console.error(
            "Indicator startup error:",
            error
        );

    }


    /*
        CHART SECOND
    */

    if (
        !checkChartLibrary()
    ) {

        /*
            Data still works even if
            chart library fails.
        */

        statusEl.textContent =
            "DATA READY";

        return;

    }


    try {

        createMainChart();

        createSlopeChart();

        updateMainChart();

        updateSlopeChart();


        statusEl.textContent =
            "RUNNING";

    }
    catch (error) {

        console.error(
            "Chart startup error:",
            error
        );


        /*
            VERY IMPORTANT:
            Chart error must NOT destroy
            the terminal data.
        */

        statusEl.textContent =
            "CHART ERROR";

    }


    /*
        CONTINUE SIMULATION
    */

    setInterval(
        addNewCandle,
        SETTINGS.simulationInterval
    );

}


/* =========================================================
   SLOPE UI ONLY
========================================================= */
