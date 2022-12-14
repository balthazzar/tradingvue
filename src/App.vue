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

        <v-select
            @input="selectQuoteHandler"
            :options="Object.keys(this.fullSymbolsInfo)"
            :value="quoteAsset">
        </v-select>
    </div>

    <grid-layout v-if="charts"
                :layout.sync="layout"
                :is-draggable="false"
                :col-num="4"
                :row-height="240">
        <grid-item v-for="item in layout"
                :x="item.x"
                :y="item.y"
                :i="item.i"
                :h="item.h"
                :w="item.w"
                :key="item.i">
            <trading-vue
                :data="charts[item.symbol]"
                :title-txt="`${item.symbol.replace('USDT', '')} ${timeframe} ${allSymbols[item.symbol].price24Change}% ${allSymbols[item.symbol].marketcap}$`"
                :width="470"
                :height="240"
                :color-back="colors.colorBack"
                :color-grid="colors.colorGrid"
                :color-text="colors.colorText">
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
                x: i % 2 ? 2 : 1,
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
                        tf: this.timeframe,
                        settings: {
                            upper: 70,
                            lower: 30
                        }
                    }
                };

                return acc;
            }, {});
        },
        fillCharts: async function(symbols) {
            const klineRequests = symbols.map(symbol => axios.get(`https://api1.binance.com/api/v3/uiKlines?symbol=${symbol}&interval=${this.timeframe}`));
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
        selectQuoteHandler(quoteAsset) {
            this.quoteAsset = quoteAsset;

            this.sendMessage(UNSUBSCRIBE_METHOD, [...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);

            console.log(this.fullSymbolsInfo[quoteAsset])
            const symbols = this.fullSymbolsInfo[quoteAsset].map(symbol => `${symbol.baseAsset}${quoteAsset}`).slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
            console.log(symbols)
            this.initLayout(symbols);
            this.initCharts(symbols);
            this.fillCharts(symbols);

            this.sendMessage(SUBSCRIBE_METHOD, [...symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...symbols.map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);
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
        }
    },
    watch: {
        page() {
            this.applyFilters();
        },
        sortParams: async function() {
            clearInterval(this.interval);

            const applySort = async () => {
                switch (this.sortParams.field) {
                    case 'price24Change':
                        const changeResponse = await axios.get(`https://api1.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(Object.keys(this.allSymbols))}`);
                        
                        changeResponse.data.forEach(item => {
                            this.allSymbols[item.symbol]['price24Change'] = +item.priceChangePercent;
                        });

                        break;
                    case 'marketcap':
                        // const apiAnswer = await axios.get(`https://api1.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(Object.keys(this.allSymbols))}`);
                        const apiAnswer = await axios.get('https://www.binance.com/exchange-api/v2/public/asset-service/product/get-products');
                        
                        apiAnswer.data.data.forEach(item => {
                            if (this.allSymbols[item.s]) {
                                this.allSymbols[item.s]['marketcap'] = item.cs * item.c;
                            }
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
    mounted: async function() {
        const exchangeInfoResponse = await axios.get('https://data.binance.com/api/v3/exchangeInfo');
        
        const fullSymbolsInfo = exchangeInfoResponse.data.symbols.reduce((acc, symbol) => {
            if (!acc[symbol.quoteAsset]) {
                acc[symbol.quoteAsset] = [];
            }

            acc[symbol.quoteAsset].push(symbol);
            return acc;
        }, {});
        console.log(fullSymbolsInfo)
        this.fullSymbolsInfo = fullSymbolsInfo;

        // console.log(exchangeInfoResponse.data);
        const allSymbols = exchangeInfoResponse.data.symbols
            .filter(symbolItem => SYMBOL_FILTER.includes(symbolItem.quoteAsset) && symbolItem.permissions.includes('SPOT'))
            .reduce((acc, symbolItem) => {
                // console.log(symbolItem)
                acc[symbolItem.symbol] = {
                    name: symbolItem.symbol,
                    marketcap: 0,
                    price24Change: 0
                };

                return acc;
            }, {});
        
        this.allSymbols = allSymbols;
        this.pageCount = Math.ceil(Object.keys(allSymbols).length / this.itemOnPage);

        Promise.all([
            axios.get(`https://api1.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(Object.keys(this.allSymbols))}`),
            axios.get('https://www.binance.com/exchange-api/v2/public/asset-service/product/get-products')
        ]).then(responses => {
            responses[0].data.forEach(item => {
                if (this.allSymbols[item.symbol]) {
                    this.allSymbols[item.symbol]['price24Change'] = +item.priceChangePercent;
                }
            });

            responses[1].data.data.forEach(item => {
                if (this.allSymbols[item.s]) {
                    this.allSymbols[item.s]['marketcap'] = item.cs * item.c;
                }
            });
        });
        
        const sortedSymbols = Object.values(this.allSymbols).sort(this.sort.bind(null, this.sortParams)).map(symbol => symbol.name);
        const symbols = sortedSymbols.slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
        
        // const symbols = this.paginateSymbols();

        this.initLayout(symbols);
        // this.layout = this.layout.sort(this.sort.bind(null, { field: 'symbol', direction: this.sortParams.isAsc }));
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
                    lastCandle = this.charts[socketData.s].chart.data.pop();

                    if (lastCandle && (socketData.E - this.lastAggTradeE) >= 200) {
                        this.lastAggTradeE = socketData.E;
                        lastCandle[4] = +socketData.p;
                    }

                    this.charts[socketData.s].chart.data.push(lastCandle);

                    break;

                default:
                    console.log(`Unknown data type: ${socketData.e}`);
            }
        }

        this.connection.onopen = () => {
            console.log("Successfully connected to the Binance websocket server")

            this.sendMessage(SUBSCRIBE_METHOD, [...symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`), ...symbols.map(symbol => `${symbol.toLowerCase()}@aggTrade`)]);
        }
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
            sortableFields: ['name', 'price24Change', 'marketcap'],
            fullSymbolsInfo: {},
            quoteAsset: 'USDT',
            lastAggTradeE: 0,
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

h1 {
  font-size: 26px;
  font-weight: 600;
}

#app {
  max-width: 30em;
  margin: 1em auto;
}
</style>