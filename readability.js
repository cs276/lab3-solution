const fs = require("fs");
const md5File = require('md5-file');
const sqlite3 = require('sqlite3');
const Tokenizer = require('tokenize-text');
const tokenize = new Tokenizer();
const tokenizeEnglish = require("tokenize-english")(tokenize);

let db = new sqlite3.Database('texts.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
});

function readability(filename, callback) {
    const filemd5 = md5File.sync(filename);

    let sql = `SELECT * FROM texts WHERE md5 = ?`;

    db.get(sql, filemd5, (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (row) {
            callback({
                cl: row["colemanliau"],
                ari: row["ari"],
                filename: row["filename"],
                letters: row["characters"],
                numbers: 0,
                words: row["words"],
                sentences: row["sentences"],
                hash: 0,
            });
        }
        else {
          fs.readFile(filename, "utf8", (err, contents) => {
              if (err) throw err;
              const text = contents.split(/\n/).join(" ");
              const data = {
                  filename: filename,
                  letters: countChars(text, /[A-Za-z]/),
                  numbers: countChars(text, /[0-9]/),
                  words: countWords(text),
                  sentences: countSentences(text),
                  hash: filemd5
              };
              const cl = colemanLiau(data);
              const ari = automatedReadabilityIndex(data);
              callback({ cl, ari, ...data });
          });
        }
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

function report(data) {
    console.log(`REPORT for ${data["filename"]}`);
    let chars = data["letters"] + data["numbers"];
    console.log(`${chars} characters`);
    console.log(`${data["words"]} words`);
    console.log(`${data["sentences"]} sentences`);
    console.log(`------------------`);
    console.log(`Coleman-Liau Score: ${data["cl"]}`);
    console.log(`Automated Readability Index: ${data["ari"]}`);
}

readability(process.argv[2], data => {
    if(data["hash"] != 0) {
      db.run(`INSERT INTO texts (filename, words, characters, sentences, md5, colemanliau, ari) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [data["filename"], data["words"], data["letters"] + data["numbers"], data["sentences"], data["hash"], data["cl"].toFixed(3), data["ari"].toFixed(3)],
              err => {
                  if (err) {
                      return console.error(err.message);
                  }
      });
    }
    report(data);
});
