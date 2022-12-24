<template>

<div>
    <paginate
        v-model="page"
        :page-count="pageCount"
        :click-handler="pageClickHandler"
        :container-class="'pagination'"
        :prev-text="'Prev'"
        :next-text="'Next'">
    </paginate>

    <div style="display: flex">
        <v-select
            @input="selectFieldHandler"
            :options="sortableFields"
            :value="sortParams.field">
        </v-select>

        <v-select
            @input="selectDirectionHandler"
            :options="['Asc', 'Desc']"
            :value="sortParams.direction ? 'Asc' : 'Desc'">
        </v-select>

        <v-select
            @input="selectTimeframeHandler"
            :options="['1m', '5m', '15m', '1h', '4h', '1d']"
            :value="timeframe">
        </v-select>
    </div>

    <v-super-select
        @input="selectQuoteHandler"
        :items="fullSymbolsInfo"
        :value="quoteAsset">
    </v-super-select>

    <grid-layout v-if="charts"
                :layout.sync="layout"
                :is-draggable="false"
                :col-num="2"
                :row-height="height">
        <grid-item v-for="item in layout"
                :x="item.x" 
                :y="item.y"
                :i="item.i"
                :h="item.h"
                :w="item.w"
                :key="item.i">
            <trading-vue
                :id="item.i.toString()"
                :data="charts[item.symbol]"
                :title-txt="`${item.symbol.replace(quoteAsset, '')} ${timeframe} ${allSymbols[item.symbol] && sortParams.field.includes('price') && allSymbols[item.symbol][sortParams.field] ? allSymbols[item.symbol][sortParams.field] : 0}% ${allSymbols[item.symbol] ? allSymbols[item.symbol].marketcap : 0}$`"
                :width="width"
                :height="height">
            </trading-vue>
        </grid-item>
    </grid-layout>

    <paginate
        v-model="page"
        :page-count="pageCount"
        :click-handler="pageClickHandler"
        :container-class="'pagination'"
        :prev-text="'Prev'"
        :next-text="'Next'">
    </paginate>
</div>


</template>

<script>
import TradingVue from 'trading-vue-js';
import { GridLayout, GridItem } from "vue-grid-layout";

import axios from 'axios';

const SUBSCRIBE_METHOD = 'SUBSCRIBE';
const UNSUBSCRIBE_METHOD = 'UNSUBSCRIBE';

const SYMBOL_FILTER = ['USDT'];

export default {
    name: 'app',
    components: { TradingVue, GridLayout, GridItem},
    methods: {
        pageClickHandler(page) {
            this.page = page;
        },
        initLayout(symbols) {
            this.layout = symbols.map((symbol, i) => ({
                x: i % 2 ? 1 : 0,
                y: i % 2 ? i - 1 : i,
                w: 1,
                h: 1,
                i,
                symbol
            }));
        },
        initCharts(symbols) {
            this.charts = symbols.reduce((acc, symbol) => {
                acc[symbol] = {
                    chart: {
                        type: 'Candles',
                        data: [],
                        tf: this.timeframe
                    }
                };

                return acc;
            }, {});
        },
        fillCharts: async function(symbols) {
            if (this.quoteAsset === 'USDT' && this.sortParams.field === 'name' && this.timeframe === '1d') {
                const klinesData = await axios.get(`http://63.250.60.80:8083/klines?page=${this.page}${this.sortParams.direction ? '' : '&desc=true'}`);

                symbols.forEach((symbol, i) => {
                    this.charts[symbol].chart.data = klinesData.data[symbol];
                });

                return;
            }

            const klineRequests = symbols.map(symbol => axios.get(`https://data.binance.com/api/v3/uiKlines?symbol=${symbol}&interval=${this.timeframe}&limit=1000&startTime=0`));
            const klineResponses = await Promise.all(klineRequests);
            
            symbols.forEach((symbol, i) => {
                this.charts[symbol].chart.data = klineResponses[i].data.map(frame =>
                    frame.slice(0, 6).map(frameField => +frameField));
            });
        },
        sort({ field, direction }, elem1, elem2) {
            if (field && (elem1[field] > elem2[field]) || (elem1 > elem2)) {
                return direction ? 1 : -1;
            }
            
            if (field && (elem1[field] < elem2[field]) || (elem1 < elem2)) {
                return direction ? -1 : 1;
            }

            return 0;
        },
        selectFieldHandler(field) {
            this.sortParams = { ...this.sortParams, field };
        },
        selectDirectionHandler(direction) {
            this.sortParams = { ...this.sortParams, direction: direction === 'Asc' };
        },
        selectTimeframeHandler(timeframe) {
            this.sendMessage(UNSUBSCRIBE_METHOD, [...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);

            this.timeframe = timeframe;

            this.initCharts(Object.keys(this.charts));
            this.fillCharts(Object.keys(this.charts));

            this.sendMessage(SUBSCRIBE_METHOD, [...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@kline_${timeframe}`), ...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);
        },
        selectQuoteHandler: async function(quoteAsset) {
            this.quoteAsset = quoteAsset;

            const symbolsResponse = await axios.get(
                `http://63.250.60.80:8083/symbols-filtered?quoteAsset=${this.quoteAsset}`
            );
            const allSymbols = symbolsResponse.data;

            this.allSymbols = allSymbols;
            this.pageCount = Math.ceil(Object.keys(allSymbols).length / this.itemOnPage);
            
            this.sendMessage(UNSUBSCRIBE_METHOD, [...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);

            const sortedSymbols = Object.values(this.allSymbols).sort(this.sort.bind(null, this.sortParams)).map(symbol => symbol.name);
            const symbols = sortedSymbols.slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
    
            this.initLayout(symbols);
            this.initCharts(symbols);
            this.fillCharts(symbols);

            this.sendMessage(SUBSCRIBE_METHOD, [...symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...symbols.map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);
            this.applyFilters();
        },
        sendMessage(method, params) {
            const message = {
                method,
                params,
                id: 1
            };
            
            this.connection.send(JSON.stringify(message));
        },
        paginateSymbols() {
            return Object.keys(this.allSymbols).slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
        },
        applyFilters() {
                // this.sendMessage(UNSUBSCRIBE_METHOD, Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@ticker`));

            const sortedSymbols = Object.values(this.allSymbols).sort(this.sort.bind(null, this.sortParams)).map(symbol => symbol.name);
            const symbols = sortedSymbols.slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
            
            if (!this.layout.map(item => item.symbol).every((symbol, i) => symbol === symbols[i])) {
                this.sendMessage(UNSUBSCRIBE_METHOD, [...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);

                this.initLayout(symbols);
                this.initCharts(symbols);
                this.fillCharts(symbols);

                this.sendMessage(SUBSCRIBE_METHOD, [...symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...symbols.map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);
            }
        },
        resizeHandler() {
            this.width = window.innerWidth * .48;
            this.height = window.innerHeight * .22;
        }
    },
    watch: {
        page() {
            this.applyFilters();
        },
        sortParams: async function() {
            clearInterval(this.interval);

            const applySort = async () => {
                const changeRequests = [];
                let changeResponse;
                let changeResponses;

                switch (this.sortParams.field) {
                    case 'price24HChange':
                        changeResponse = await axios.get(`https://data.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(Object.keys(this.allSymbols))}`);
                        
                        changeResponse.data.forEach(item => {
                            this.allSymbols[item.symbol]['price24HChange'] = +item.priceChangePercent;
                        });

                        break;
                    case 'price5mChange':
                        for (let i = 0; i < Object.keys(this.allSymbols).length; i += 100) {
                            changeRequests.push(axios.get(`https://data.binance.com/api/v3/ticker?windowSize=5m&symbols=${JSON.stringify(Object.keys(this.allSymbols).slice(i, i + 100))}`));
                        }

                        changeResponses = await Promise.all(changeRequests);
                        
                        changeResponses.forEach(changeResponse => {
                            changeResponse.data.forEach(item => {
                                this.allSymbols[item.symbol]['price5mChange'] = +item.priceChangePercent;
                            });
                        });

                        break;
                    case 'price1HChange':
                        for (let i = 0; i < Object.keys(this.allSymbols).length; i += 100) {
                            changeRequests.push(axios.get(`https://data.binance.com/api/v3/ticker?windowSize=1h&symbols=${JSON.stringify(Object.keys(this.allSymbols).slice(i, i + 100))}`));
                        }

                        changeResponses = await Promise.all(changeRequests);
                        
                        changeResponses.forEach(changeResponse => {
                            changeResponse.data.forEach(item => {
                                this.allSymbols[item.symbol]['price1HChange'] = +item.priceChangePercent;
                            });
                        });

                        break;
                    case 'price4HChange':
                        for (let i = 0; i < Object.keys(this.allSymbols).length; i += 100) {
                            changeRequests.push(axios.get(`https://data.binance.com/api/v3/ticker?windowSize=4h&symbols=${JSON.stringify(Object.keys(this.allSymbols).slice(i, i + 100))}`));
                        }

                        changeResponses = await Promise.all(changeRequests);
                        
                        changeResponses.forEach(changeResponse => {
                            changeResponse.data.forEach(item => {
                                this.allSymbols[item.symbol]['price4HChange'] = +item.priceChangePercent;
                            });
                        });

                        break;
                    case 'price7DChange':
                        for (let i = 0; i < Object.keys(this.allSymbols).length; i += 100) {
                            changeRequests.push(axios.get(`https://data.binance.com/api/v3/ticker?windowSize=7d&symbols=${JSON.stringify(Object.keys(this.allSymbols).slice(i, i + 100))}`));
                        }

                        changeResponses = await Promise.all(changeRequests);
                        
                        changeResponses.forEach(changeResponse => {
                            changeResponse.data.forEach(item => {
                                this.allSymbols[item.symbol]['price7DChange'] = +item.priceChangePercent;
                            });
                        });

                        break;
                }
                
                this.applyFilters();
            };

            applySort();

            this.interval = setInterval(applySort, 30 * 1000);
            // this.sendMessage(SUBSCRIBE_METHOD, symbols.map(symbol => `${symbol.toLowerCase()}@ticker`));
        },
        timeframe() {
            this.applyFilters();
        }
    },
    created() {
        window.addEventListener("resize", this.resizeHandler);
    },
    destroyed() {
        window.removeEventListener("resize", this.resizeHandler);
    },
    mounted: async function() {
        console.log(window.innerWidth, window.innerHeight);
        const symbolsResponse = await axios.get(
            `http://63.250.60.80:8083/symbols-filtered?quoteAsset=${this.quoteAsset}`
        );

        const allSymbols = symbolsResponse.data;

        this.allSymbols = allSymbols;
        this.pageCount = Math.ceil(Object.keys(allSymbols).length / this.itemOnPage);

        const sortedSymbols = Object.values(this.allSymbols).sort(this.sort.bind(null, this.sortParams)).map(symbol => symbol.name);
        const symbols = sortedSymbols.slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
        
        this.initLayout(symbols);
        this.initCharts(symbols);
        this.fillCharts(symbols);

        this.connection = new WebSocket("wss://data-stream.binance.com:9443/ws");

        this.connection.onmessage = (event) => {
            const socketData = JSON.parse(event.data);
            // console.log(socketData);

            switch (socketData.e) {
                case 'kline':
               //      console.log(socketData.s, this.charts)
                    let lastCandle = this.charts[socketData.s].chart.data.pop();


                    if (lastCandle) {
                        if (lastCandle[0] !== socketData.k.t) {
                            this.charts[socketData.s].chart.data.push(lastCandle);
                            this.charts[socketData.s].chart.data.push([
                                +socketData.k.t,
                                +socketData.k.o,
                                +socketData.k.h,
                                +socketData.k.l,
                                +socketData.k.c,
                                +socketData.k.v
                            ]);
                        } else {
                            lastCandle[2] = +socketData.k.h;
                            lastCandle[3] = +socketData.k.l;
                            lastCandle[5] = +socketData.k.v;
                            this.charts[socketData.s].chart.data.push(lastCandle);
                        }
                    }

                    break;
/*                 case '24hrTicker':
                    if (!this.sortParams.field !== 'price24hChange') {
                        this.sendMessage(UNSUBSCRIBE_METHOD, [`${socketData.s.toLowerCase()}@ticker`]);
                        break;
                    }

                    this.allSymbols[socketData.s][this.sortParams.field] = socketData.P;
                    this.allSymbols = this.allSymbols.sort(this.sort.bind(null, { direction: this.sortParams.direction }));
                    break;
 */             
                case 'aggTrade': 
                    lastCandle = this.charts[socketData.s]?.chart?.data?.pop();

                    if (lastCandle && (socketData.E - this.lastAggTradeE) >= 200) {
                        this.lastAggTradeE = socketData.E;
                        lastCandle[4] = +socketData.p;
                    }

                    this.charts[socketData.s].chart.data.push(lastCandle);

                    break;

                default:
                    console.log(`Unknown data type: ${socketData.e}`);
            }
        };

        this.connection.onopen = () => {
            console.log("Successfully connected to the Binance websocket server")

            this.sendMessage(SUBSCRIBE_METHOD, [...symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...symbols.map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);
        };

        Promise.all([
            axios.get(`https://data.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(Object.keys(this.allSymbols))}`),
            axios.get('http://63.250.60.80:8083/categories')
        ]).then(responses => {
            responses[0].data.forEach(item => {
                if (this.allSymbols[item.symbol]) {
                    this.allSymbols[item.symbol]['price24HChange'] = +item.priceChangePercent;
                }
            });

            const sortedCategories = ['coins', 'ALTS', 'FIAT', 'Zones'];
            const fullSymbolsInfo = sortedCategories.map(category => (
                    {
                        groupName: category,
                        items: responses[1].data[category].map(item => ({
                            text: item,
                            value: item
                        }))
                    }
            ));

/*             const fullSymbolsInfo = responses[2].data.reduce((acc, symbol) => {
                if (!acc[symbol.quoteAsset]) {
                    acc[symbol.quoteAsset] = [];
                }

                acc[symbol.quoteAsset].push(symbol);
                return acc;
            }, {});

 */            this.fullSymbolsInfo = fullSymbolsInfo;
            console.log(this.fullSymbolsInfo)
        });
    },
    data() {
        return {
            charts: null,
            connection: null,
            colors: {
                colorBack: '#fff',
                colorGrid: '#eee',
                colorText: '#333',
            },
            layout: [],
            symbols: null,
            page: 1,
            pageCount: 1,
            itemOnPage: 20,
            timeframe: '1d',
            sortParams: {
                field: 'name',
                direction: true
            },
            sortableFields: ['name', 'marketcap', 'price5mChange', 'price1HChange', 'price4HChange', 'price24HChange', 'price7DChange'],
            fullSymbolsInfo: [{ value: 'USDT', text: 'USDT' }],
            quoteAsset: 'USDT',
            lastAggTradeE: 0,
            width: window.innerWidth * .48,
            height: window.innerHeight * .22,
        }
    }
}
</script>
<style>
body {
  font-family: "Source Sans Pro", "Helvetica Neue", Arial, sans-serif;
  text-rendering: optimizelegibility;
  -moz-osx-font-smoothing: grayscale;
  -moz-text-size-adjust: none;
}

h1,
.muted {
  color: #2c3e5099;
}

#app {
  max-width: 30em;
  margin: 1em auto;
}

.t-vue-title {
    font-size: calc(100vw * 0.017 + 1px) !important;
}
</style>