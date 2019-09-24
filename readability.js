const fastCSV = require('fast-csv')
const fs = require('fs')
const md5File = require('md5-file')
const Tokenizer = require('tokenize-text')
const tokenize =  new Tokenizer()
const tokenizeEnglish = require('tokenize-english')(tokenize)

const resultsFile = 'results.csv'


function countChars(text, regexp) {
    const chars = tokenize.characters()(text)
    if (regexp) {
        // For each char, call the callback and pass the char as the 2nd argument
        // Pass the return value of the previous callback call as the 1st argument
        // Pass 0 as the 1st argument for the initial callback call
        // Result is total number of chars that match regexp
        return chars.reduce((count, c) => count + regexp.test(c.value), 0)
    }
    else {
        return chars.length
    }
}


function countWords(text) {
    return tokenize.words()(text).length
}


function countSentences(text) {
    return tokenizeEnglish.sentences()(text).length
}


function printResults(row) {
    console.log([
        `REPORT FOR ${row.filename}:`,
        `${row.characters} character(s)`,
        `${row.words} words(s)`,
        `${row.sentences} sentence(s)`,
        '-----------------------------',
        `Coleman-Liau Score: ${row.cl}`,
        `Automated Readability Index: ${row.ari}`
    ].join('\n'))
}


/**
 * Parse CSV file then call callback, passing in rows and row count as arguments
 */
function parseCSV(callback) {
    const rows = []

    // Parse CSV
    const csvParser = fastCSV.parseFile(resultsFile, {headers: true})

    // Exit on error
    csvParser.on('error', (err) => { throw err })

    // Handle each row until we find hash or the last row
    .on('data', (row) => {
        rows.push(row)
    })
    .on('end', (rowCount) => {
        callback(rows, rowCount)
    })
}


/**
 * Save one or more rows to CSV file then optionally call callback
 */
function saveResults(rows, callback=(rows)=>{}) {
    fastCSV.writeToStream(
        fs.createWriteStream(resultsFile, {flags: 'a'}),
        rows,
        {
            // TODO set headers conditioanlly based on whether file is empty?
            // headers: true,
            includeEndRowDelimiter: true
        }
    )
    .on('error', (err) => { throw err })
    .on('finish', () => callback(rows))
}


/**
 * Given a filename, read the contents of the file, analyize using CL and ARI,
 * then save the results and call callback, passing in results row as an argument
 */
function calculateResults(filename, hash, callback) {
    fs.readFile(filename, 'utf-8', (err, data) => {
        if (err) {
            throw err
        }

        data = data.split('\n').join(' ')
        const characters = countChars(data, /[A-Za-z]/) + countChars(data, /[0-9]/)
        const words = countWords(data)
        const sentences = countSentences(data)

        const cl = colemanLiau(characters, words, sentences)
        const ari = automatedReadabilityIndex(characters, words, sentences)
        const row = {
            filename,
            hash,
            characters,
            words,
            sentences,
            cl,
            ari
        }

        saveResults([row])
        callback(row)
    })
}


function colemanLiau(chars, words, sentences) {
    return (
        (0.0588 * (chars * 100.0 / words))
      - (0.296 * (sentences * 100.0) / words)
      - 15.8
    ).toFixed(3)
}


function automatedReadabilityIndex(chars, words, sentences) {
    return (
        (4.71 * (chars / words))
      + (0.5 * (words / sentences))
      - 21.43
    ).toFixed(3)
}


module.exports = {
    colemanLiau,
    automatedReadabilityIndex,
    parseCSV
}


// If run with node ./readability.js (as opposed to require('./readability'))
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node ./readability.js FILENAME')
        process.exit(1)
    }

    const dataFile = process.argv[2]

    // Hash file
    md5File(dataFile, (err, hash) => {
        if (err)
            throw err

        parseCSV((rows, rowCount) => {
            const row = rows.find((row) => row.hash === hash )
            if (row) {
                printResults(row)
            }
            else {
                calculateResults(dataFile, hash, (row) => {
                    printResults(row)
                })
            }
        })
    })
}
