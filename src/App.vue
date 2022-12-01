<template>
<grid-layout v-if="charts"
            :layout.sync="layout"
            :col-num="4"
            :row-height="190">
    <grid-item v-for="item in layout"
            :x="item.x"
            :y="item.y"
            :i="item.i"
            :h="item.h"
            :w="item.w"
            :key="item.i">
        <trading-vue
            :data="charts[item.symbol]"
            :title-txt="item.symbol"
            :width="400"
            :height="190"
            :color-back="colors.colorBack"
            :color-grid="colors.colorGrid"
            :color-text="colors.colorText">
        </trading-vue>
    </grid-item>
</grid-layout>

</template>

<script>
import TradingVue from 'trading-vue-js'
import { GridLayout, GridItem } from "vue-grid-layout"

import axios from 'axios';

export default {
    name: 'app',
    components: { TradingVue, GridLayout, GridItem},
    methods: {
        onResize(event) {
            this.width = window.innerWidth
            this.height = window.innerHeight
        },
    },
    mounted: async function() {
        window.addEventListener('resize', this.onResize)

        const exchangeInfoResponse = await axios.get('https://api1.binance.com/api/v3/exchangeInfo');
        const symbols = exchangeInfoResponse.data.symbols
            .filter(symbolItem => 'USDT' === symbolItem.quoteAsset)
/*            
            .sort((symbol1, symbol2) => {
                if (symbol1.baseAsset > symbol2.baseAsset) {
                    return 1;
                }
                
                if (symbol1.baseAsset < symbol2.baseAsset) {
                    return -1;
                }

                return 0;
            })
 */            
            .slice(0, 20)
            .map(symbolItem => symbolItem.symbol);
        
        this.layout = symbols.map((symbol, i) => ({
            x: i % 2 ? 2 : 1,
            y: i % 2 ? i - 1 : i,
            w: 1,
            h: 1,
            i,
            symbol
        }));
        console.log(this.layout)

        this.charts = symbols.reduce((acc, symbol) => {
            acc[symbol] = {
                chart: {
                    type: 'Candles',
                    data: [],
                    tf: '1m',
                    settings: {
                        upper: 70,
                        lower: 30
                    }
                }
            };

            return acc;
        }, {});

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

        this.connection.onopen = async (event) => {
            console.log("Successfully connected to the Binance websocket server...")

            const symbols = Object.keys(this.charts);
            const klineRequests = symbols.map(symbol => axios.get(`https://api1.binance.com/api/v3/uiKlines?symbol=${symbol}&interval=1m`));
            const klineResponses = await Promise.all(klineRequests);
            
            for (let i = 0; i < symbols.length; i++) {
                this.charts[symbols[i]].chart.data = klineResponses[i].data.map(frame => frame.slice(0, 6).map(frameField => +frameField));
            }

            const message = {
                method: "SUBSCRIBE",
                params: symbols.map(symbol => `${symbol.toLowerCase()}@kline_1m`),
                id: 1
            };
            
            this.connection.send(JSON.stringify(message));

            this.symbols = symbols;
        }
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.onResize)
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
            layout: []
        }
    }
}
</script>
