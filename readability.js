const fs = require("fs");
const sqlite3 = require('sqlite3');
const Tokenizer = require('tokenize-text');
const tokenize = new Tokenizer();
const tokenizeEnglish = require("tokenize-english")(tokenize);

function readability(filename, callback) {
    fs.readFile(filename, "utf8", (err, contents) => {
        if (err) throw err;
        const text = contents.split(/\n/).join(" ");
        const data = {
            filename: filename,
            letters: countChars(text, /[A-Za-z]/),
            numbers: countChars(text, /[0-9]/),
            words: countWords(text),
            sentences: countSentences(text)
        };
        const cl = colemanLiau(data);
        const ari = automatedReadabilityIndex(data);
        callback({ cl, ari, ...data });
    });
}


// Returns number of characters, optionally matching a regular expression
function countChars(text, regexp) {
    const characters = tokenize.characters()(text);
    if (regexp)
        return characters.reduce((count, c) => count + regexp.test(c.value), 0);
    else
        return characters.length;
}

// Returns number of words in text
function countWords(text) {
    return tokenize.words()(text).length;
}

// Returns number of English sentences in text
function countSentences(text) {
    return tokenizeEnglish.sentences()(text).length;
}

// Computes Coleman-Liau readability index
function colemanLiau(data) {
    const { letters, words, sentences } = data;
    return (0.0588 * (letters * 100 / words))
        - (0.296 * (sentences * 100 / words))
        - 15.8;
}

// Computes Automated Readability Index
function automatedReadabilityIndex(data) {
    let { letters, numbers, words, sentences } = data;
    return (4.71 * ((letters + numbers) / words))
        + (0.5 * (words / sentences))
        - 21.43;
}

let db = new sqlite3.Database('texts.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
});

readability(process.argv[2], data => {
    db.run(`INSERT INTO texts (filename, words, characters, sentences, colemanliau, ari) VALUES (?, ?, ?, ?, ?, ?)`,
            [data["filename"], data["words"], data["letters"] + data["numbers"], data["sentences"], data["cl"].toFixed(3), data["ari"].toFixed(3)],
            err => {
                if (err) {
                    return console.error(err.message);
                }
    });
    report(data);
});

function report(data) {
    console.log(`REPORT for ${data["filename"]}`);
    let chars = data["letters"] + data["numbers"];
    console.log(`${chars} characters`);
    console.log(`${data["words"]} words`);
    console.log(`${data["sentences"]} sentences`);
    console.log(`------------------`);
    console.log(`Coleman-Liau Score: ${data["cl"].toFixed(3)}`);
    console.log(`Automated Readability Index: ${data["ari"].toFixed(3)}`);
}
