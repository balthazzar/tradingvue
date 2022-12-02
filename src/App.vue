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
                :title-txt="`${item.symbol} ${timeframe}`"
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
import TradingVue from 'trading-vue-js'
import { GridLayout, GridItem } from "vue-grid-layout"

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
        setLayout(symbols) {
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
        sortSymbols(symbol1, symbol2) {
            if (symbol1.baseAsset > symbol2.baseAsset) {
                return 1;
            }
            
            if (symbol1.baseAsset < symbol2.baseAsset) {
                return -1;
            }

            return 0;
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
            return this.allSymbols.slice((this.page - 1) * this.itemOnPage, (this.page - 1) * this.itemOnPage + this.itemOnPage);
        }
    },
    watch: {
        page: async function(page) {
            this.sendMessage(UNSUBSCRIBE_METHOD, Object.keys(this.charts).map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`));
            
            const symbols = this.paginateSymbols();

            this.setLayout(symbols);
            this.initCharts(symbols);
            this.fillCharts(symbols);

            this.sendMessage(SUBSCRIBE_METHOD, symbols.map(symbol => `${symbol.toLowerCase()}@kline_1m`));
        }
    },
    mounted: async function() {
        const exchangeInfoResponse = await axios.get('https://api1.binance.com/api/v3/exchangeInfo');
        const allSymbols = exchangeInfoResponse.data.symbols
            .filter(symbolItem => SYMBOL_FILTER.includes(symbolItem.quoteAsset)) // .sort(this.sortSymbols)
            .map(symbolItem => symbolItem.symbol);
        
        this.allSymbols = allSymbols;
        this.pageCount = Math.ceil(allSymbols.length / this.itemOnPage);
        
        const symbols = this.paginateSymbols();

        this.setLayout(symbols);
        this.initCharts(symbols);

        this.connection = new WebSocket("wss://stream.binance.com:9443/ws")

        this.connection.onmessage = (event) => {
            const socketData = JSON.parse(event.data);

            if (socketData.e && socketData.e === 'kline') {
                const candles = this.charts[socketData.s].chart.data;
                const lastCandle = candles[candles.length - 1];
                
                if (lastCandle[0] === socketData.k.t) {
                    this.charts[socketData.s].chart.data.pop();
                }

                this.charts[socketData.s].chart.data.push([
                    +socketData.k.t,
                    +socketData.k.o,
                    +socketData.k.h,
                    +socketData.k.l,
                    +socketData.k.c,
                    +socketData.k.v
                ]);
            }
        }

        this.connection.onopen = async () => {
            console.log("Successfully connected to the Binance websocket server")

            //const symbols = Object.keys(this.charts);

            this.fillCharts(symbols);
            this.sendMessage(SUBSCRIBE_METHOD, symbols.map(symbol => `${symbol.toLowerCase()}@kline_${this.timeframe}`));
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
            timeframe: '1d'
        }
    }
}
</script>
