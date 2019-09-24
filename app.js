const express = require('express')
const path = require('path')

const app = express()
const port = 3000

const readability = require('./readability')

app.use('/static', express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/results', (req, res) => {
    readability.parseCSV((rows) => {
        res.json(rows)
    })
})

app.listen(port, () => console.log(`Listening on port ${port}...`))
