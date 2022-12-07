import Vue from 'vue';

import Paginate from 'vuejs-paginate';
import vSelect from 'vue-select';

import App from './App.vue';

Vue.component("v-select", vSelect);
Vue.component('paginate', Paginate);

new Vue({
    el: '#app',
    render: h => h(App)
});

