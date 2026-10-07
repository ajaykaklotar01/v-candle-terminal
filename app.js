/* =========================================================
   V CANDLE TERMINAL
   Trading-style chart engine
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

let simulationTimer = null;


/* =========================================================
   LIGHTWEIGHT CHART REFERENCES
========================================================= */

let mainChart = null;

let slopeChart = null;

let priceSeries = null;

let vCandleSeries = null;

let slopeSeries = null;

let slopeBullLine = null;

let slopeBearLine = null;

let slopeZeroLine = null;


/* =========================================================
   DOM
========================================================= */

const priceEl =
    document.getElementById("price");

const statusEl =
    document.getElementById("status");

const lastTimeEl =
    document.getElementById("lastTime");

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

    const d = new Date(time);

    return d.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    );

}


/* =========================================================
   SIMULATED CANDLES
========================================================= */

function createInitialCandles() {

    const result = [];

    let price = SETTINGS.startingPrice;

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

            open,

            high,

            low,

            close

        });


        price = close;

    }


    lastPrice = price;

    return result;

}


/* =========================================================
   CREATE NEXT CANDLE
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

        open,

        high,

        low,

        close

    };

}


/* =========================================================
   CHART CREATION
========================================================= */

function createCharts() {

    const chartContainer =
        document.getElementById("chart");


    const slopeContainer =
        document.getElementById("slopeChart");


    /*
        MAIN PRICE CHART
    */

    mainChart =
        LightweightCharts.createChart(
            chartContainer,
            {

                autoSize: true,

                layout: {

                    background: {
                        type:
                            LightweightCharts.ColorType.Solid,
                        color: "#111318"
                    },

                    textColor: "#858b95",

                    fontSize: 11,

                    fontFamily:
                        "Inter, system-ui, sans-serif",

                    attributionLogo: true

                },


                /*
                    GRID DISABLED
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

                        color: "#8a8f98",

                        style:
                            LightweightCharts.LineStyle.Dashed,

                        labelVisible: true,

                        labelBackgroundColor:
                            "#252a33"

                    },

                    horzLine: {

                        visible: true,

                        width: 1,

                        color: "#8a8f98",

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

                    barSpacing: 8,

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
        NORMAL MARKET CANDLES
    */

    priceSeries =
        mainChart.addSeries(
            LightweightCharts.CandlestickSeries,
            {

                upColor: "#36b37e",

                downColor: "#e05d5d",

                borderVisible: false,

                wickUpColor: "#36b37e",

                wickDownColor: "#e05d5d"

            }
        );


    /*
        V CANDLE OVERLAY
    */

    vCandleSeries =
        mainChart.addSeries(
            LightweightCharts.CandlestickSeries,
            {

                upColor:
                    "rgba(54,179,126,0.28)",

                downColor:
                    "rgba(224,93,93,0.28)",

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
        CURRENT PRICE LINE
    */

    priceSeries.createPriceLine({

        price: lastPrice,

        color: "#c9cdd4",

        lineWidth: 1,

        lineStyle:
            LightweightCharts.LineStyle.Dashed,

        axisLabelVisible: true,

        title: "PRICE"

    });


    /*
        SLOPE CHART
    */

    slopeChart =
        LightweightCharts.createChart(
            slopeContainer,
            {

                autoSize: true,

                layout: {

                    background: {
                        type:
                            LightweightCharts.ColorType.Solid,
                        color: "#111318"
                    },

                    textColor: "#707783",

                    fontSize: 10,

                    fontFamily:
                        "Inter, system-ui, sans-serif",

                    attributionLogo: false

                },


                /*
                    ALSO NO GRID
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

                        top: 0.12,

                        bottom: 0.12

                    }

                },


                timeScale: {

                    visible: false,

                    rightOffset: 8,

                    barSpacing: 8

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

                    axisPressedMouseMove: true

                }

            }
        );


    slopeSeries =
        slopeChart.addSeries(
            LightweightCharts.LineSeries,
            {

                color: "#7d8794",

                lineWidth: 2,

                priceLineVisible: false,

                lastValueVisible: true

            }
        );


    /*
        V SLOPE LEVELS
    */

    slopeBullLine =
        slopeSeries.createPriceLine({

            price: 0.03,

            color: "#36b37e",

            lineWidth: 1,

            lineStyle:
                LightweightCharts.LineStyle.Dashed,

            axisLabelVisible: true,

            title: "BULL"

        });


    slopeBearLine =
        slopeSeries.createPriceLine({

            price: -0.03,

            color: "#e05d5d",

            lineWidth: 1,

            lineStyle:
                LightweightCharts.LineStyle.Dashed,

            axisLabelVisible: true,

            title: "BEAR"

        });


    slopeZeroLine =
        slopeSeries.createPriceLine({

            price: 0,

            color: "#777d87",

            lineWidth: 1,

            lineStyle:
                LightweightCharts.LineStyle.Dashed,

            axisLabelVisible: false

        });


    /*
        CROSSHAIR EVENT
    */

    mainChart.subscribeCrosshairMove(
        handleCrosshair
    );


    /*
        INITIAL SIZE
    */

    window.addEventListener(
        "resize",
        resizeCharts
    );

}


/* =========================================================
   CROSSHAIR OHLC
========================================================= */

function handleCrosshair(param) {

    if (
        !param ||
        !param.time ||
        !param.seriesData
    ) {

        return;

    }


    const candle =
        param.seriesData.get(priceSeries);


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


    /*
        Crosshair time
    */

    if (typeof param.time === "number") {

        const date =
            new Date(param.time * 1000);

        lastTimeEl.textContent =
            date.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }
            );

    }

}


/* =========================================================
   RESIZE
========================================================= */

function resizeCharts() {

    if (mainChart) {

        mainChart.timeScale().fitContent();

    }

}


/* =========================================================
   UPDATE MAIN CHART
========================================================= */

function updateMainChart() {

    if (!priceSeries) return;


    const marketData =
        candles.map(c => ({

            time: unixSeconds(c.time),

            open: c.open,

            high: c.high,

            low: c.low,

            close: c.close

        }));


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


    for (const c of vc) {

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

            open: c.open,

            high: c.high,

            low: c.low,

            close: c.close

        });

    }


    vCandleSeries.setData(
        vData
    );


    /*
        Keep chart close to latest candle
        without destroying user's ability
        to pan historical data.
    */

    const logicalRange =
        mainChart.timeScale()
            .getVisibleLogicalRange();


    if (!logicalRange) {

        mainChart.timeScale()
            .fitContent();

    }


    /*
        Update current price line
    */

    updateCurrentPriceLine();


    /*
        Update OHLC display
    */

    const last =
        candles[candles.length - 1];

    if (last) {

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

}


/* =========================================================
   CURRENT PRICE LINE
========================================================= */

let currentPriceLine = null;


function updateCurrentPriceLine() {

    if (!priceSeries) return;


    if (currentPriceLine) {

        priceSeries.removePriceLine(
            currentPriceLine
        );

    }


    currentPriceLine =
        priceSeries.createPriceLine({

            price: lastPrice,

            color: "#c9cdd4",

            lineWidth: 1,

            lineStyle:
                LightweightCharts.LineStyle.Dashed,

            axisLabelVisible: true,

            title: "PRICE"

        });

}


/* =========================================================
   UPDATE V SLOPE
========================================================= */

function updateSlopeChart() {

    if (!slopeSeries) return;


    const slope =
        calculateVSlope(
            candles,
            60,
            60,
            5,
            0.03
        );


    const data = [];


    for (const item of slope) {

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


    /*
        Keep slope aligned with price
    */

    const mainRange =
        mainChart.timeScale()
            .getVisibleLogicalRange();


    if (mainRange) {

        slopeChart.timeScale()
            .setVisibleLogicalRange(
                mainRange
            );

    }


    /*
        Current slope status
    */

    const last =
        slope[slope.length - 1];


    if (!last) return;


    const value =
        last.value;


    if (value == null) {

        return;

    }


    vSlopeValueEl.textContent =
        value.toFixed(4);

    vSlopeCardValueEl.textContent =
        value.toFixed(4);


    let state =
        "NEUTRAL";


    if (value > 0.03) {

        state = "BULLISH";

    }
    else if (value < -0.03) {

        state = "BEARISH";

    }


    vSlopeSignalEl.textContent =
        state;

    vSlopeSignalCardEl.textContent =
        state;

}


/* =========================================================
   UPDATE VLOT
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


    if (!result) return;


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
   
