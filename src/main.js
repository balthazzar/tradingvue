import Vue from 'vue';
import Paginate from 'vuejs-paginate';

import App from './App.vue';

Vue.component('paginate', Paginate);

new Vue({
    el: '#app',
    render: h => h(App)
});

