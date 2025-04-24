import puppeteer from 'puppeteer';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

import {exec as openssl} from 'openssl-wrapper';
import crypto from 'crypto';
import dayjs from 'dayjs'

import nodemailer from 'nodemailer';

import * as dotenv from 'dotenv';
dotenv.config();

const sslDayWarnings = [1,2,7,30]; // days between each set of warnings

let transporter = null
const createEmailConnection = async () => {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 0,
    secure: process.env.SMTP_TLS === 'yes' ? true : false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
    },
  });
};
const emailHandler = async (requestId, options) => {
  return await transporter
  .sendMail({
      from: `${options.from || process.env.EMAIL_FROM}`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
  })
  .then((info) => {
      console.log(`${requestId} - Mail sent successfully!!`);
      console.log(`${requestId} - [MailResponse]=${info.response} [MessageID]=${info.messageId}`);
      return info;
  });
}
const sendEmail = async (reqId,to,from,subject,html) => {
  await createEmailConnection();
  await emailHandler(reqId, {
    to,
    from,
    subject,
    html,
  });
}




// https://stackoverflow.com/a/41563966
function csvToArray(text) {
    let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
    for (l of text) {
        if ('"' === l) {
            if (s && l === p) row[i] += l;
            s = !s;
        } else if (',' === l && s) l = row[++i] = '';
        else if ('\n' === l && s) {
            if ('\r' === p) row[i] = row[i].slice(0, -1);
            row = ret[++r] = [l = '']; i = 0;
        } else row[i] += l;
        p = l;
    }
    return ret;
};

const parseCSV = async (filepath, encoding, keys) => {
  const textContent = await readFile(filepath, encoding);
  const rows = csvToArray(textContent);

  const resultArray = [];
  for(let row of rows){
    if (row.length !== keys.length) {
      break;
    }
    if (row[0][0] === '#') {
      continue;
    }

    const newRow = {};
    for (let i=0; i<keys.length; i++) {
      newRow[keys[i]] = row[i];
    }
    resultArray.push(newRow);
  }

  return resultArray;
}

const outputCSV = async (filepath, rows, keys) => {
  let outputStr = `#${keys.join()}\n`;
  for (const row of rows) {
    for (let i=0; i<keys.length; i++) {
      const separator = i < (keys.length - 1) ? ',' : '\n'
      outputStr += `"${row[keys[i]]}"${separator}`
    }
  }

  await writeFile(filepath, outputStr);
}

// https://stackoverflow.com/a/61304202
const waitTillHTMLRendered = async (page, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while(checkCounts++ <= maxChecks){
    let html = await page.content();
    let currentHTMLSize = html.length; 

    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
      countStableSizeIterations++;
    else 
      countStableSizeIterations = 0; //reset the counter

    if(countStableSizeIterations >= minStableSizeIterations) {
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }  
};

const renderHtml = async (url, selector) => {
  const browser = await puppeteer.launch({
    //headless: true,
    headless: 'new',
    //executablePath: '/usr/bin/chromium-browser',
    executablePath: '/usr/bin/chromium',
    args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
    ]
  });
  const page = await browser.newPage();

  await page.goto(url,{'timeout': 100000, 'waitUntil':'load'});
  await waitTillHTMLRendered(page)

  const result = await page.evaluate((selector) => {
    return document.querySelector(selector).innerHTML;
  }, selector);

  await browser.close();
  return result
}

(async () => {
  if(!existsSync('list.csv')) {
    console.log("list.csv file not found");
    return;
  }
  const configData = await parseCSV('list.csv', 'utf8', ['url','selector','email']);
  
  let resultData = [];
  if(existsSync('result.csv')) {
    resultData = await parseCSV('result.csv', 'utf8', ['url','result']);
  }

  const newResults = [];

  for (const config of configData) {
    const result = await renderHtml(config.url, config.selector);
    const prevResult = resultData.find(obj => obj.url === config.url);
    if (prevResult && prevResult.result !== result.replaceAll('"','')) {
      console.log('send email');
//       await sendEmail(
//         '',
//         // process.env.EMAIL_TO,
//         config.email,
//         process.env.EMAIL_FROM,
//         `Change detected to ${config.url}`,
//         `
//         <html>
//           <head>
//           </head>
//           <body>
//             <span>Website change detected to ${config.url}</span>

//             <div style="font-size: 8pt; margin-top: 10px;">
//               <p>
// This email has been created by the <a href="https://github.com/gazzenger/web-scrape-notifier" target="_blank">Web-Scrap-Notifier</a> Open Source project by Gary Namestnik
// <br/>
// Gary Namestnik does not accept any responsibility or liability for the accuracy, content, completeness, legality, or reliability of the information contained in this email.
// <br/>
// No warranties, promises and/or representations of any kind, expressed or implied, are given as to the nature, standard, accuracy or otherwise of the information provided in this email nor to the suitability or otherwise of the information.
// <br/>
// We shall not be liable for any loss or damage of whatever nature (direct, indirect, consequential, or other) whether arising in contract, tort or otherwise, which may arise as a result of your use of (or inability to use) the content from this email, or from your use of (or failure to use) the information in this email. This email provides links to other websites owned by third parties. The content of such third party sites is not within our control, and we cannot and will not take responsibility for the information or content thereon. Links to such third party sites are not to be taken as an endorsement by Gary Namestnik of the third party site, or any products promoted, offered or sold on the third party site, nor that such sites are free from computer viruses or anything else that has destructive properties. We cannot and do not take responsibility for the collection or use of personal data from any third party site. In addition, we will not accept responsibility for the accuracy of third party advertisements.
//             </p>
//           </div>
//           </body>
//         </html>
//         `
//       );

    }
    newResults.push({
      url: config.url,
      result: result,
    });
  }

  await outputCSV('result.csv', newResults, ['url', 'result']);

  // check SSL certificates
  if(!existsSync('ssl-list.csv')) {
    console.log("ssl-list.csv file not found");
    return;
  }
  const sslConfigData = await parseCSV('ssl-list.csv', 'utf8', ['host','port','email']);
  
  let sslResultData = [];
  if(existsSync('ssl-result.csv')) {
    sslResultData = await parseCSV('ssl-result.csv', 'utf8', ['host', 'port', 'fingerprint', 'days']);
  }

  const newSslResultData = [];

  for (const config of sslConfigData) {
    const prevSslResult = sslResultData.find(obj => (obj.host === config.host) && (obj.port === config.port));
    let cert = {fingerprint: -1}
    let days = 365;

    try {
      cert = await getTlsCert(config);
      days = validateCertExpiry(cert, prevSslResult);
    }
    catch (e) {
      console.log('failed to retrieve ssl cert')
      if (!prevSslResult || (prevSslResult && prevSslResult.fingerprint !== "-1")) {
        console.log('send email')
      }
    }

    newSslResultData.push({
      host: config.host,
      port: config.port,
      fingerprint: cert.fingerprint,
      days
    });
  }

  await outputCSV('ssl-result.csv', newSslResultData, ['host', 'port', 'fingerprint', 'days']);
})();

const getTlsCert = async (config) => {
  return new Promise((resolve, reject) => {
    openssl('s_client', prepareOpenSslParams(config.host,config.port), (err, buffer) => {
      if (err) {
        return reject(err); // Reject the promise if there's an error
      }
      const cert = new crypto.X509Certificate(buffer);
      resolve(cert);
    })
  })
}

const prepareOpenSslParams = (host,port) => {
  let returnObj = {
    'showcerts': true,
    'servername': host,
    'connect': `${host}:${port}`
  };

  return (Number(port) === 25) ? {
    ...returnObj,
    'starttls': 'smtp'
  } : returnObj;
};

const validateCertExpiry = (cert, prevSslResult) => {
  // verify cert has not already expired
  if (dayjs(cert.validToDate).isBefore(dayjs())) {
    console.log('cert already expired')
    console.log('send an email')
    return 0;
  }

  const prevDayCount = Number(prevSslResult?.days) || 365;
  const dayCount = dayjs(cert.validToDate).diff(dayjs(), 'days');

  const prevDayWarningIdx = sslDayWarnings.findIndex((item) => {
    return item > prevDayCount;
  });
  const currentDayWarningIdx = sslDayWarnings.findIndex((item) => {
    return item > dayCount;
  });

  if (prevDayWarningIdx !== currentDayWarningIdx) {
    console.log('send an email')
  }

  return dayCount;
}
