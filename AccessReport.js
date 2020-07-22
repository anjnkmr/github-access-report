const fs = require('fs');
const fetch = require('node-fetch');

var cliArgs = process.argv.slice(2);
if (cliArgs[0] === undefined) {
    console.error('ORG_CODE not provided');
    console.log('Usage', 'node AccessReport.js <ORG_CODE> <API_KEY>');
    return;
}

if (cliArgs[1] === undefined) {
    console.error('API_KEY not provided');
    console.log('Usage', 'node AccessReport.js <ORG_CODE> <API_KEY>');
    return;
}

const BASE_URI = 'https://api.github.com';
const ORG_CODE = cliArgs[0]
const API_KEY = cliArgs[1];
const API = {
    MEMBER_LIST: BASE_URI + '/orgs/' + ORG_CODE + '/members',
    TEAMS_LIST: BASE_URI + '/orgs/' + ORG_CODE + '/teams'
};
let USERS = [];
let TEAMS = [];
let requiredData = [];
function doCall(url) {
    let noRecordsFound = false;
    let page = 1;
    return new Promise(async (resolve, reject) => {
        let fullData = [];
        while(!noRecordsFound) {
            const data = await fetch(url + '?page=' + page, { headers: { 'Authorization': 'bearer ' + API_KEY } });
            page++;
            const pageData = await data.json();
            if (pageData.length === 0) {
                noRecordsFound = true;
            } else {
                // console.log('page', pageData);
                fullData.push(...pageData);
            }
        }
        resolve(fullData);
    });

}

async function fetchData() {
    USERS = await doCall(API.MEMBER_LIST);
    TEAMS = await doCall(API.TEAMS_LIST);
    const aloop = async() => {
        for (let i = 0; i < TEAMS.length; i++) {
            let element = TEAMS[i];
            // console.log(element);
            element.members_url = element.members_url.replace('{/member}', '');
            if (element.members === undefined) {
                element.members = [];
            }
            if (element.repos === undefined) {
                element.repos = [];
            }
            element.members.push(...await doCall(element.members_url));
            element.repos.push(...await doCall(element.repositories_url));
            TEAMS[i] = element;
        }
    }
    await aloop();
    TEAMS.forEach(team => {
        team.members.forEach(member => {
            const userIndex = USERS.findIndex(user => user.login === member.login);
            if (USERS[userIndex].repos === undefined) {
                USERS[userIndex].repos = [];
            }
            USERS[userIndex].repos.push(...team.repos);
        });
    });
    USERS.forEach(user => {
        if (user.repos === undefined) {
            user.repos = [];
        }
        // console.log('User', user.login, user.repos.length);
        user.repos.forEach(repo => {
            requiredData.push({'user': user.login, repo});
        });
    })
    console.log('================    Report Generation Started     ==========================');
    let data = 'User,Repo Name,Pull,Triage,Push,Maintain,Admin\n'; 
    requiredData.map(v => data += v.user + ', ' + v.repo.name + ', ' + v.repo.permissions.pull + ', ' + v.repo.permissions.triage + ', ' + v.repo.permissions.push + ', ' + v.repo.permissions.maintain + ', ' + v.repo.permissions.admin + '\n');
    const date = new Date();
    const timestamp = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '_' + date.getHours() + '-' + date.getMinutes() + '-' + date.getSeconds();
    const fileName = 'Report_' + timestamp + '.csv';
    fs.writeFileSync(fileName, data);
    console.log('File name: ' + fileName);
    console.log('================    Report Generation Completed   ==========================');

}
fetchData();
