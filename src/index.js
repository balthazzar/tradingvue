const dotenv = require('dotenv');
const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

dotenv.config();

if (!process.env.PORT) {
    process.exit(1);
}
 
const PORT = parseInt(process.env.PORT, 10);

const app = express();

app.use(express.static(path.resolve(__dirname, '../webpack/dist')));
app.use(compression());

app.get('/', (req, res) => {
    res.sendFile('dist/index.html', { root: path.join(__dirname, '../webpack') });
})

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

