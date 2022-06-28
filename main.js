//Discord stuff
const discord = require('discord.js');
const fetch = require('node-fetch');
const cron = require('cron');
const config = require('./config.json');
const client = new discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS"] })
const token = config.token;

let fs = require("fs");

const { stringify } = require('querystring');

//load json files
let riskRollsJSON = require('./risk_rolls.json');
let quotesJSON = require('./quotes.json');
let riskLoadouts = require('./riskLoadouts.json');
let birthdaysJson = require('./birthdays.json');
let cronTime = require('./cronjobLookup.json');
const { doesNotThrow } = require('assert');

const prefix = '!';

//To add characters to the rolls, need to add to this character array and also in risk_rolls.json
let survivors = ['commando', 'huntress', 'bandit', 'mul_t', 'engineer', 'artificer', 'mercenary', 'rex', 'loader', 'acrid', 'captain', 'railgunner', 'voidfiend'];

///////////////////////////////////////////////
///////////////    CRON JOBS    ///////////////
///////////////////////////////////////////////
// All cronjob times need to be adjusted back
// by 4 hours to account for the server time 
// zone
///////////////////////////////////////////////

let dailyDogPic = new cron.CronJob(cronTime._10am, () => {
    const guild = getGuild(config.serverID);
    const channel = getChannel(guild, config.channelIDs.dogPics);
    channel.send('Your Daily Dog pic!');
    dogPic().then(pic => channel.send(pic));
});

let lastOnlineJob = new cron.CronJob(cronTime.everyHour, () => {

    let now = new Date().toLocaleTimeString('en-US',
    {timeZone:'UTC',hour12:true,hour:'numeric',minute:'numeric'}
    );
    let date = new Date();
    
    config.lastOnline = now + ' on '+ (date.getMonth() + 1) + '/' + date.getDate();
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2), function (err) {
      if (err) throw err;
  });
    
});

let getGMETickerJob = new cron.CronJob(cronTime.weekdays6PM, async () =>{
    let symbol = 'GME';
    let ticker = await getTicker(symbol);
    const guild = getGuild(config.serverID);
    const channel = getChannel(guild, config.channelIDs.GMEChannel);
    sendTickerInfoToServer(ticker, channel);
});

//Send random quote on the 21st of every month. "Every 3 weeks" 0 22 */21 */1 *
// let sendRandomQuoteToServer = new cron.CronJob('0 22 */21 */1 *', () => {
//     const guild = client.guilds.cache.get(config.serverID);
//     const channel = guild.channels.cache.get(config.channelIDs.main);
//     channel.send('Hey guys, remember this?');
//     getRandomQuoteForServer(channel);
// });

//Everyday at noon, check if there is a birthday coming up. 0 16 * * * -noon
let birthdayReminder = new cron.CronJob(cronTime.noon, () => {
    
    delete require.cache[require.resolve('./birthdays.json')]
    birthdaysJson = require('./birthdays.json');

    const today = new Date();

    Object.keys(birthdaysJson).forEach(function (key) {
        if (key != 'comingUpBirthdays') {
            const birthday = new Date(birthdaysJson[key]);
            if (birthdayComingUp(today, birthday) && !birthdaysJson.comingUpBirthdays.includes(key)) {
                //update birthdays 
                birthdaysJson.comingUpBirthdays.push(key);
                fs.writeFileSync('./birthdays.json', JSON.stringify(birthdaysJson, null, 2), function (err) {
                    if (err) throw err;
                }
                );
 
                const guild = getGuild(config.severID);
                const channel = getChannel(guild, config.channelIDs.main);
                channel.send(capitalizeFirstLetter(key) + '\'s birthday is coming up! ' + (birthday.getMonth()+1) + '/' + birthday.getDate());
            }
            if (pastBirthday(today, birthday)) {
                birthdaysJson.comingUpBirthdays.pop(key);
                fs.writeFileSync('./birthdays.json', JSON.stringify(birthdaysJson, null, 2), function (err) {
                    if (err) throw err;
                }
                );
            }
        }
    });

});

///////////////////////////////////////////////
///////////      END CRON JOBS     ////////////
///////////////////////////////////////////////

client.on('messageCreate', m => {
    if (!m.content.startsWith(prefix) || m.author.bot) return;

    //parse the command
    const args = m.content.slice(prefix.length).split(" ");

    //console.log("Command sent", [m.author.username, args[0], args[1], args[2], args[3]]);
    fs.appendFile("command_log.txt", stringToWrite(m.author.username, args) + "\r\n", function (err) {
        if (err) throw err;
    });

    doCommand(args, m);
});

//Formats the string to write to the log.
function stringToWrite(member, args) {

    let log = member + ": ";

    for (let a of args) {
        if (a != null) {
            log += (a + " ");
        }
    }

    return log;
}

//Executes the command
function doCommand(args, m) {

    const command = args[0].toLowerCase();

    switch (command) {

        case 'dog':
            m.channel.send("Doggy!");
            dogPic().then(pic => m.channel.send(pic));
            break;
        case 'uptime':
            let uptime = getUptime();
            m.channel.send(uptime);
            break;
        case 'number':
            getNumber(args[1], args[2], m);
            break;
        case 'risk':
            rollRiskCharacter(m);
            break;
        case 'stats':
            printRiskPlayerStatsRolls(args[1], m);
            break;
        case 'loadout':
            getRiskLoadout(args[1], m);
            break;
        case 'last':
            getLastRoll(m);
            break;
        case 'quote':
            if ('get' == args[1]) {
                getRandomQuote(args[2], m);
            }
            else {
                if(args[1] == undefined) {
                    m.channel.send('Don\'t save an empty quote or use !quote get.');
                }
                else{
                    saveQuote(args, m);
                }
            }
            break;
        case 'stock':
            getStockTickerInfo(args[1], m);
            break;
        case 'commands':
            printCommands(m);
            break;
    }
}

//Gets stock ticker prices for the day
async function getStockTickerInfo(symbol, member){

    try{
        symbol = symbol.toUpperCase();
        let ticker = await getTicker(symbol);
        sendTickerInfoToServer(ticker, member.channel);
    }
    catch(exception){
        member.channel.send('No such symbol or data not available');
    }
}

//Returns if there is a bithday coming up within a week
function birthdayComingUp(today, birthday){
    var today_ = new Date(today);
    var birthday_ = new Date(birthday);
    today.setFullYear(today_.getFullYear());
    birthday_.setFullYear(today_.getFullYear());

    // To calculate the time difference of two dates
    var timeDifference = birthday_.getTime() - today_.getTime();
  
    // To calculate the no. of days between two dates
    var daysDifference = timeDifference / (1000 * 3600 * 24);

    return daysDifference <= 7 && daysDifference >= 0;
}

//Returns if a birthday has been passed
function pastBirthday(today, birthday){
    var today_ = new Date(today);
    var birthday_ = new Date(birthday);
    today.setFullYear(today_.getFullYear());
    birthday_.setFullYear(today_.getFullYear());

    // To calculate the time difference of two dates
    var timeDifference = birthday_.getTime() - today_.getTime();
  
    // To calculate the no. of days between two dates
    var daysDifference = timeDifference / (1000 * 3600 * 24);

    return daysDifference <= 0;
}

//Send formatted stock ticker prices to the server
function sendTickerInfoToServer(ticker, channel){

    let m = '';
    let open = ticker['1. open'];
    let high = ticker['2. high'];
    let low = ticker['3. low'];
    let close = ticker['4. close'];
    let volume = ticker['5. volume'];
    let percentChange = ((close - open) / open * 100);
    let today = new Date();
    let padding = ' ';
    

    m = ((today.getMonth() + 1) + '/' + today.getDate()) + '\n' +
        '```' + '|----------|------------|' + '\n' + 
                '| Open     | ' + String(('$'+open.substring(0, open.length - 2)).padStart(10, padding))    + ' |' + '\n' +
                '| High     | ' + String(('$'+high.substring(0, high.length - 2)).padStart(10, padding))    + ' |' + '\n' +
                '| Low      | ' + String(('$'+low.substring(0, low.length - 2)).padStart(10, padding))      + ' |' + '\n' +
                '| Close    | ' + String(('$'+close.substring(0, close.length - 2)).padStart(10, padding))  + ' |' + '\n' +
                '| Volume   | ' + String(volume.padStart(10, padding))                                      + ' |' + '\n' +
                '| % Change | ' + (String(percentChange.toFixed(2).toString() + '%').padStart(10, padding)) + ' |' + '\n' +
                '|----------|------------|```';

    channel.send(m);
}

//Displays the number of rolls  
function printRiskPlayerStatsRolls(player, m) {

    try {
        if (player != undefined) {
            player = player.toLowerCase();
        }
        switch (player) {

            case 'tj':
                m.channel.send(printCharacterRolls(riskRollsJSON.tj, player));
                break;
            case 'noah':
                m.channel.send(printCharacterRolls(riskRollsJSON.noah, player));
                break;
            case 'mikey':
                m.channel.send(printCharacterRolls(riskRollsJSON.mikey, player));
                break;
            case undefined:
                m.channel.send(printAllPlayerCharacterRolls(riskRollsJSON));
                break;
            default:
                m.channel.send("Need a valid name");
        }
    }
    catch (exception) {
        m.channel.send('Something went wrong');
    }
}

//Picks a random character to play and updates the JSON file to count how
//many time each player has rolled each character
//Also updates the the last roll field
function rollRiskCharacter(m) {

    let survivor = getRandomSurvivor();

    if (m.author.username == 'itomj') {
        updateRiskRollsJson(survivor, riskRollsJSON.tj);
    }
    if (m.author.username == 'Feelsbadman') {
        updateRiskRollsJson(survivor, riskRollsJSON.noah);
    }
    if (m.author.username == 'CallMe_Mikey') {
        updateRiskRollsJson(survivor, riskRollsJSON.mikey);
    }
    m.channel.send(capitalizeFirstLetter(survivor));
}

//Picks a random Survivor
function getRandomSurvivor() {
    return survivors[Math.floor(Math.random() * survivors.length)];
}

//gets a random number
function getNumber(argMin, argMax, m) {

    let min;
    let max;
    if (isNaN(argMin) && isNaN(argMax)) {
        min = 0;
        max = 1000000;
    }
    else {
        min = Math.ceil(argMin);
        max = Math.floor(argMax);
    }
    let num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!m == null) {
        m.channel.send('You rolled a ' + num);
    }
    return num;
}

//shows a picture of a random dog
function dogPic() {
    return fetch("https://dog.ceo/api/breeds/image/random")
        .then(res => {
            return res.json()
        })
        .then(data => {
            return data["message"];
        })
}

function getTicker(ticker) {

    let d = new Date();
    let url = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=' + ticker + '&apikey=DVSFJCTH1FKZJE2L';
    let date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, 0) + '-' + String(d.getDate()).padStart(2, 0);
   
    return fetch(url)
        .then(res => {
            return res.json()
        })   
        .then(data => {
            return data['Time Series (Daily)'][date];
        })
}

function saveQuote(args, m) {

    let quote = "";

    for (let i = 1; i < args.length; i++) {
        quote += args[i]
        quote += " ";
    }

    addQuoteToJson(m.author.id, quote.trim());
    m.channel.send('Quote saved!');
}

function addQuoteToJson(memberID, quote) {

    quotesJSON[memberID].push(quote);

    fs.writeFileSync('./quotes.json', JSON.stringify(quotesJSON, null, 2), function (err) {
        if (err) throw err;
    }
    );

}

function getRandomQuoteForServer(channel){
    let quote = '';
    let listOfIDsToIgnore = ['']; //These IDs are ones we don't want to find in quotes

    let name = getMemberNameFromRandomID();
    while(listOfIDsToIgnore.includes(getMemberIDFromName(name)) || quotesJSON[getMemberIDFromName(name)].length == 0){
         name = getMemberNameFromRandomID();
    }
    let randomMemberID = getMemberIDFromName(name);
    quote = getQuoteFromRandomMemberID(randomMemberID);
    quote += '\n' + '   - Added by: ' + capitalizeFirstLetter(getMemberNameFromID(randomMemberID));
     channel.send(quote);
}

function getRandomQuote(memberName, m) {

    let quote = '';
    let listOfIDsToIgnore = ['410164514303115266', '668616932160831523']; //These IDs are ones we don't want to find in quotes

    //no member specified, get random quote
    if (memberName == undefined) {
        let name = getMemberNameFromRandomID();
        while(listOfIDsToIgnore.includes(getMemberIDFromName(name)) || quotesJSON[getMemberIDFromName(name)].length == 0){
            name = getMemberNameFromRandomID();
        }
        let randomMemberID = getMemberIDFromName(name);
        quote = getQuoteFromRandomMemberID(randomMemberID);
        quote += '\n' + '   - Added by: ' + capitalizeFirstLetter(getMemberNameFromID(randomMemberID));
        m.channel.send(quote);
    }
    else {
        let memberID = getMemberIDFromName(memberName.toLowerCase());
        if (memberID != undefined) {
            quote = getQuoteFromRandomMemberID(memberID);
            quote += ('\n' + '- Added by: ' + capitalizeFirstLetter(getMemberNameFromID(memberID)));
            m.channel.send(quote);
        }
        else{
            m.channel.send('Not a valid person');
        }
    }
}

//Gets a loadout of a Survivor, updates the last picked Survivor and updates the rolls count
function getRiskLoadout(survivor, m) {

    try {
        if (survivor == undefined) {
            survivor = getRandomSurvivor();
        }

        survivor = survivor.toLowerCase();
        let survivorPrint = capitalizeFirstLetter(survivor);

        let msg;

        if ('mul-t' == survivor) {
            survivor = 'mul_t';
            msg = '``` ' + 'MUL-T' + '\n' +
                'Misc: '      + riskLoadouts[survivor].misc[getNumber(0, riskLoadouts[survivor].misc.length - 1, null)] + '\n' +
                'Primary 1: ' + riskLoadouts[survivor].primary[getNumber(0, riskLoadouts[survivor].primary.length - 1, null)] + '\n' +
                'Primary 2: ' + riskLoadouts[survivor].primary[getNumber(0, riskLoadouts[survivor].primary.length - 1, null)] + '\n' +
                'Secondary: ' + riskLoadouts[survivor].secondary[getNumber(0, riskLoadouts[survivor].secondary.length - 1, null)] + '\n' +
                'Utility: '   + riskLoadouts[survivor].utility[getNumber(0, riskLoadouts[survivor].utility.length - 1, null)] + '\n' +
                'Special: '   + riskLoadouts[survivor].special[getNumber(0, riskLoadouts[survivor].special.length - 1, null)] + '```';

            survivorPrint = 'mul_t';
        }
        else if ('captain' == survivor) {
            msg = '``` '      + survivorPrint + '\n' +
                'Misc: '      + riskLoadouts[survivor].misc[getNumber(0, riskLoadouts[survivor].misc.length - 1, null)] + '\n' +
                'Primary: '   + riskLoadouts[survivor].primary[getNumber(0, riskLoadouts[survivor].primary.length - 1, null)] + '\n' +
                'Secondary: ' + riskLoadouts[survivor].secondary[getNumber(0, riskLoadouts[survivor].secondary.length - 1, null)] + '\n' +
                'Utility: '   + riskLoadouts[survivor].utility[getNumber(0, riskLoadouts[survivor].utility.length - 1, null)] + '\n' +
                'Special 1: ' + riskLoadouts[survivor].special[getNumber(0, riskLoadouts[survivor].special.length - 1, null)] + '\n' +
                'Special 2: ' + riskLoadouts[survivor].special[getNumber(0, riskLoadouts[survivor].special.length - 1, null)] + '```';
        }
        else {
            msg = '``` '      + survivorPrint + '\n' +
                'Misc: '      + riskLoadouts[survivor].misc[getNumber(0, riskLoadouts[survivor].misc.length - 1, null)] + '\n' +
                'Primary: '   + riskLoadouts[survivor].primary[getNumber(0, riskLoadouts[survivor].primary.length - 1, null)] + '\n' +
                'Secondary: ' + riskLoadouts[survivor].secondary[getNumber(0, riskLoadouts[survivor].secondary.length - 1, null)] + '\n' +
                'Utility: '   + riskLoadouts[survivor].utility[getNumber(0, riskLoadouts[survivor].utility.length - 1, null)] + '\n' +
                'Special: '   + riskLoadouts[survivor].special[getNumber(0, riskLoadouts[survivor].special.length - 1, null)] + '```';
        }

        if (m.author.username == 'itomj') {
            updateRiskRollsJson(survivorPrint, riskRollsJSON.tj);
        }
        if (m.author.username == 'Feelsbadman') {
            updateRiskRollsJson(survivorPrint, riskRollsJSON.noah);
        }
        if (m.author.username == 'DJ Enerate') {
            updateRiskRollsJson(survivorPrint, riskRollsJSON.matt);
        }
        if (m.author.username == 'CallMe_Mikey') {
            updateRiskRollsJson(survivorPrint, riskRollsJSON.mikey);
        }
        m.channel.send(msg);
    }
    catch (exception) {
        m.channel.send("Not a valid Survivor");
    }
}

//Displays how long the bot has been up
function getUptime() {

    let days = 0;
    let uptime = '';
    let totalSeconds = (client.uptime / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = Math.floor(totalSeconds % 60);
    if (hours > 24) {
        days = Math.floor(hours / 24);
    }

    if (minutes > 60) {
        minutes = 0;
    }
    hours = Math.floor(24 - (hours / 24));
    uptime += `${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds`;

    return uptime;
}

//Gets the last Survivor a player rolled
function getLastRoll(m) {
    if (m.author.username == 'itomj') {
        m.channel.send(capitalizeFirstLetter(riskRollsJSON.tj.last));
    }
    if (m.author.username == 'Feelsbadman') {
        m.channel.send(capitalizeFirstLetter(riskRollsJSON.noah.last));
    }
    if (m.author.username == 'CallMe_Mikey') {
        m.channel.send(capitalizeFirstLetter(riskRollsJSON.mikey.last));
    }
}

//Capitalizes the first character of a string
function capitalizeFirstLetter(string) {
    if(string == 'tj'){
        return 'TJ';
    }
    return string.charAt(0).toUpperCase() + string.slice(1);
}

//Displays how many times a player rolled each character
function printCharacterRolls(json, player) {

    let total = 0;

    if (player == 'tj') {
        player = player.toUpperCase();
    } else {
        player = capitalizeFirstLetter(player);
    }

    total = getTotalRolls(json);

    let padding = " ";

    return '```| ' + player + '\n' +
        '|------------|-----|\n' +
        '| Commando   | ' + String(json.commando).padStart(3, padding)   + ' |\n' +
        '| Huntress   | ' + String(json.huntress).padStart(3, padding)   + ' |\n' +
        '| Bandit     | ' + String(json.bandit).padStart(3, padding)     + ' |\n' +
        '| MUL-T      | ' + String(json.mul_t).padStart(3, padding)      + ' |\n' +
        '| Engineer   | ' + String(json.engineer).padStart(3, padding)   + ' |\n' +
        '| Artificer  | ' + String(json.artificer).padStart(3, padding)  + ' |\n' +
        '| Mercenary  | ' + String(json.mercenary).padStart(3, padding)  + ' |\n' +
        '| Rex        | ' + String(json.rex).padStart(3, padding)        + ' |\n' +
        '| Loader     | ' + String(json.loader).padStart(3, padding)     + ' |\n' +
        '| Acrid      | ' + String(json.acrid).padStart(3, padding)      + ' |\n' +
        '| Captain    | ' + String(json.captain).padStart(3, padding)    + ' |\n' +
        '| Railgunner | ' + String(json.railgunner).padStart(3, padding) + ' |\n' +
        '| Void Fiend | ' + String(json.voidfiend).padStart(3, padding)  + ' |\n' +
        '| Total      | ' + String(total).padStart(3, 0)                 + ' |\n' +
        '|------------|-----|```';
}

//Prints all the rolls of each player
function printAllPlayerCharacterRolls(json) {

    let padding = " ";

    return '```' +
        '| Survior    | TJ | Noah | Mikey |\n' +
        '|------------|----|------|-------|\n' +
        '| Commando   | ' + capitalizeFirstLetter(String(json.tj.commando).padStart(3, padding))   + '|' + capitalizeFirstLetter(String(json.noah.commando).padStart(6, padding))   + '|' + capitalizeFirstLetter(String(json.mikey.commando).padStart(7, padding))   + '|\n' +
        '| Huntress   | ' + capitalizeFirstLetter(String(json.tj.huntress).padStart(3, padding))   + '|' + capitalizeFirstLetter(String(json.noah.huntress).padStart(6, padding))   + '|' + capitalizeFirstLetter(String(json.mikey.huntress).padStart(7, padding))   + '|\n' +
        '| Bandit     | ' + capitalizeFirstLetter(String(json.tj.bandit).padStart(3, padding))     + '|' + capitalizeFirstLetter(String(json.noah.bandit).padStart(6, padding))     + '|' + capitalizeFirstLetter(String(json.mikey.bandit).padStart(7, padding))     + '|\n' +
        '| MUL-T      | ' + capitalizeFirstLetter(String(json.tj.mul_t).padStart(3, padding))      + '|' + capitalizeFirstLetter(String(json.noah.mul_t).padStart(6, padding))      + '|' + capitalizeFirstLetter(String(json.mikey.mul_t).padStart(7, padding))      + '|\n' +
        '| Engineer   | ' + capitalizeFirstLetter(String(json.tj.engineer).padStart(3, padding))   + '|' + capitalizeFirstLetter(String(json.noah.engineer).padStart(6, padding))   + '|' + capitalizeFirstLetter(String(json.mikey.engineer).padStart(7, padding))   + '|\n' +
        '| Artificer  | ' + capitalizeFirstLetter(String(json.tj.artificer).padStart(3, padding))  + '|' + capitalizeFirstLetter(String(json.noah.artificer).padStart(6, padding))  + '|' + capitalizeFirstLetter(String(json.mikey.artificer).padStart(7, padding))  + '|\n' +
        '| Mercenary  | ' + capitalizeFirstLetter(String(json.tj.mercenary).padStart(3, padding))  + '|' + capitalizeFirstLetter(String(json.noah.mercenary).padStart(6, padding))  + '|' + capitalizeFirstLetter(String(json.mikey.mercenary).padStart(7, padding))  + '|\n' +
        '| Rex        | ' + capitalizeFirstLetter(String(json.tj.rex).padStart(3, padding))        + '|' + capitalizeFirstLetter(String(json.noah.rex).padStart(6, padding))        + '|' + capitalizeFirstLetter(String(json.mikey.rex).padStart(7, padding))        + '|\n' +
        '| Loader     | ' + capitalizeFirstLetter(String(json.tj.loader).padStart(3, padding))     + '|' + capitalizeFirstLetter(String(json.noah.loader).padStart(6, padding))     + '|' + capitalizeFirstLetter(String(json.mikey.loader).padStart(7, padding))     + '|\n' +
        '| Acrid      | ' + capitalizeFirstLetter(String(json.tj.acrid).padStart(3, padding))      + '|' + capitalizeFirstLetter(String(json.noah.acrid).padStart(6, padding))      + '|' + capitalizeFirstLetter(String(json.mikey.acrid).padStart(7, padding))      + '|\n' +
        '| Captain    | ' + capitalizeFirstLetter(String(json.tj.captain).padStart(3, padding))    + '|' + capitalizeFirstLetter(String(json.noah.captain).padStart(6, padding))    + '|' + capitalizeFirstLetter(String(json.mikey.captain).padStart(7, padding))    + '|\n' +
        '| Railgunner | ' + capitalizeFirstLetter(String(json.tj.railgunner).padStart(3, padding)) + '|' + capitalizeFirstLetter(String(json.noah.railgunner).padStart(6, padding)) + '|' + capitalizeFirstLetter(String(json.mikey.railgunner).padStart(7, padding)) + '|\n' +
        '| Void Fiend | ' + capitalizeFirstLetter(String(json.tj.voidfiend).padStart(3, padding))  + '|' + capitalizeFirstLetter(String(json.noah.voidfiend).padStart(6, padding))  + '|' + capitalizeFirstLetter(String(json.mikey.voidfiend).padStart(7, padding))  + '|\n' +
        '| Total      | ' + String(getTotalRolls(json.tj)).padStart(3, padding)                    + '|' + String(getTotalRolls(json.noah)).padStart(6, padding)                    + '|' + String(getTotalRolls(json.mikey)).padStart(7, padding)                    + '|\n' +
        '|------------|----|------|-------|```';
}

//Counts the total rolls
function getTotalRolls(json) {
    let total = 0;

    for (const [key, value] of Object.entries(json)) {
        if (key != 'last') {
            total += value;
        }
    }
    return total;
}

//Updates the JSON file that keeps track of the character rolls
function updateRiskRollsJson(survivor, memberJSON) {

    if ('mul-t' == survivor) {
        memberJSON['mul_t']++;
    }
    else {
        memberJSON[survivor.toLowerCase()]++;
    }
    //Sets the last rolled Survivor
    memberJSON.last = survivor;
    fs.writeFileSync('./risk_rolls.json', JSON.stringify(riskRollsJSON, null, 2), function (err) {
        if (err) throw err;
    }
    );
}

//Displays all of the commands
function printCommands(m) {

    let cmd = '```| Commands              | Description                                                                           |\n' +
        '|-----------------------|---------------------------------------------------------------------------------------|\n' +
        '| !dog                  | Get a random picture of a dog :).                                                     |\n' +
        '| !number               | Get a random number between 0 and 1M.                                                 |\n' +
        '| !number <min> <max>   | Get a random number in the range.                                                     |\n' +
        '| !risk                 | Picks a random Risk of Rain 2 Survivor.                                               |\n' +
        '| !loadout              | Picks a random Risk of Rain 2 Survivor and loadout.                                   |\n' +
        '| !loadout <survivor>   | Generates a loadout for the Survivor.                                                 |\n' +
        '| !stats                | Gets the number of all players Survivor rolls in Risk of Rain 2 for a specifc player. |\n' +
        '| !stats <person>       | Gets the number of Survivor rolls in Risk of Rain 2.                                  |\n' +
        '| !last                 | Gets the last Survivor you rolled.                                                    |\n' +
        '| !quote <quote to add> | Adds a quote to be remembered.                                                        |\n' +
        '| !quote get            | Gets a random quote from a random member.                                             |\n' +
        '| !quote get <person>   | Gets a random quote from a specific member.                                           |\n' +
        '| !stock <symbol>       | Gets stock prices for the day of the given symbol.                                    |\n' +
        '| !uptime               | Time that the R.A.M.I.S has been online.                                              |\n' +
        '|-----------------------|---------------------------------------------------------------------------------------|\n```';

    m.channel.send(cmd);
}

function randomWelcomeMessage(m) {

    let messages = ['Welcome to the Cave, ' + m.user.username + '!'];

    return messages[Math.floor(Math.random() * messages.length)];
}

client.once('ready', () => {
    botOnline();
    dailyDogPic.start()
    birthdayReminder.start();
    getGMETickerJob.start();
    lastOnlineJob.start();
    //sendRandomQuoteToServer.start();
});

function botOnline(){
    console.log('Bot Online')
    const guild = getGuild(config.serverID);
    const channel = getChannel(guild, config.channelIDs.botOnline);
    let now = new Date().toLocaleTimeString('en-US',
    {timeZone:'UTC',hour12:true,hour:'numeric',minute:'numeric'}
    );
    channel.send('Bot Online @ '+ now);
}

client.on('guildMemberAdd', member => {
    const guild = getGuild(member.guild.id);
    if (guild == config.serverID) {
        const channel = getChannel(guild, config.channelIDs.main);
        channel.send(randomWelcomeMessage(member));
    }
});

//Needs to be the last line
client.login(token);

function getGuild(guildID) {
    return client.guilds.cache.get(guildID);
}

function getChannel(guild, channelID){
    return guild.channels.cache.get(channelID);
}

function getMemberNameFromID(id){
    return Object.keys(config.memberIDLookup).find(key => config.memberIDLookup[key] === id);
}

function getMemberNameFromRandomID(){
    return Object.keys(config.memberIDLookup)[Math.floor(Math.random() * Object.keys(config.memberIDLookup).length)];
}

function getMemberIDFromName(name){
    return config.memberIDLookup[name];
}

function getQuoteFromRandomMemberID(id){
    return '\"' + quotesJSON[id][Math.floor(Math.random() * quotesJSON[id].length)] + '\"';
}