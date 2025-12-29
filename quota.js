import util from "node:util" ;
import { exec } from "node:child_process";
import nodemailer from 'nodemailer';

import * as dotenv from 'dotenv';
dotenv.config();


import { parseCSV } from './index.js';


let execute = util.promisify(exec);

const criticalThreshold = 0.9;
const warningThreshold = 0.8;
const infoThreshold = 0.7;


let transporter = null
const createEmailConnection = async () => {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 0,
    secure: process.env.SMTP_TLS === 'yes' ? true : false,
    requireTLS: process.env.SMTP_REQUIRETLS === 'yes' ? true : false,
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
    html:         `
        <html>
        <head>
        </head>
        <body>
            ${html}
            <div style="font-size: 8pt; margin-top: 10px;">
            <p>
This email has been created by the <a href="https://github.com/gazzenger/web-scrape-notifier" target="_blank">Web-Scrap-Notifier</a> Open Source project by Gary Namestnik
<br/>
Gary Namestnik does not accept any responsibility or liability for the accuracy, content, completeness, legality, or reliability of the information contained in this email.
<br/>
No warranties, promises and/or representations of any kind, expressed or implied, are given as to the nature, standard, accuracy or otherwise of the information provided in this email nor to the suitability or otherwise of the information.
<br/>
We shall not be liable for any loss or damage of whatever nature (direct, indirect, consequential, or other) whether arising in contract, tort or otherwise, which may arise as a result of your use of (or inability to use) the content from this email, or from your use of (or failure to use) the information in this email. This email provides links to other websites owned by third parties. The content of such third party sites is not within our control, and we cannot and will not take responsibility for the information or content thereon. Links to such third party sites are not to be taken as an endorsement by Gary Namestnik of the third party site, or any products promoted, offered or sold on the third party site, nor that such sites are free from computer viruses or anything else that has destructive properties. We cannot and do not take responsibility for the collection or use of personal data from any third party site. In addition, we will not accept responsibility for the accuracy of third party advertisements.
            </p>
        </div>
        </body>
        </html>
        `
  });
}

(async () => {
  // get current hdd space
  const { stdout: hostname } = await execute(`hostname -f`);
  const { stdout: hddStatsStr } = await execute(`df --output=used,size / | grep -vE '^Used|1K-blocks' | awk {'print "["$1","$2"]"'}`);
  const [ hddUsage, hddSize ] = JSON.parse(hddStatsStr);
  const hddThreshold = hddUsage / hddSize;

  if (hddThreshold > criticalThreshold) {
    await sendEmail(
      '',
      process.env.EMAIL_TO,
      process.env.EMAIL_FROM,
      `URGENT!! Hard drive at critical level on ${hostname}`,
      `<span>The hard drive on ${hostname} is currently at a critical level (above ${criticalThreshold}%), currently at ${(hddThreshold * 100).toFixed(2)}% (${(hddUsage / 1024 / 1024).toFixed(2)} GB of ${(hddSize / 1024 / 1024).toFixed(2)} GB)</span><br/><span>Please make room, or emails will start to bounce.</span>`
    );
  }
  else if (hddThreshold > warningThreshold) {
    await sendEmail(
      '',
      process.env.EMAIL_TO,
      process.env.EMAIL_FROM,
      `WARNING!! Hard drive has reached warning level on ${hostname}`,
      `<span>The hard drive on ${hostname} is currently at a warning level (above ${warningThreshold}%), currently at ${(hddThreshold * 100).toFixed(2)}% (${(hddUsage / 1024 / 1024).toFixed(2)} GB of ${(hddSize / 1024 / 1024).toFixed(2)} GB)</span><br/><span>Please make room in this mailbox, or emails will start to bounce.</span>`
    );
  }
  else if (hddThreshold > infoThreshold) {
    await sendEmail(
      '',
      process.env.EMAIL_TO,
      process.env.EMAIL_FROM,
      `INFO! Hard drive has reached info level on ${hostname}`,
      `<span>The hard drive on ${hostname} is currently at an info level (above ${infoThreshold}%), currently at ${(hddThreshold * 100).toFixed(2)}% (${(hddUsage / 1024 / 1024).toFixed(2)} GB of ${(hddSize / 1024 / 1024).toFixed(2)} GB)</span>`
    );
  }

  // get postfix configured mailbox size limits
  const { stdout: mailboxSizeLimit } = await execute(`postconf -h mailbox_size_limit`);
  const { stdout: virtualSizeLimit } = await execute(`postconf -h virtual_mailbox_limit`);
  const mailboxSizeLimitInt = parseInt(mailboxSizeLimit) || Infinity
  const virtualSizeLimitInt = parseInt(virtualSizeLimit) || Infinity
  const mailboxQuota = Math.min(mailboxSizeLimitInt,virtualSizeLimitInt)

  //console.log(mailboxQuota);

  // get current mailbox sizes
  const currentMailboxSizes = await parseCSV('mailbox-sizes.csv', 'utf8', ['email','size']);
//  console.log(currentMailboxSizes);

  // iterate over mailboxes and compare to quota
  for (const mailbox of currentMailboxSizes) {
    //console.log(mailbox.email)
    const mailboxSize = parseInt(mailbox.size);
    const threshold = mailboxSize / mailboxQuota;
    
    if (threshold > criticalThreshold) {
      await sendEmail(
        '',
        process.env.EMAIL_TO,
        process.env.EMAIL_FROM,
        `URGENT!! Mailbox quota at critical level for ${mailbox.email}`,
        `<span>The mailbox ${mailbox.email} is currently at a critical level (above ${criticalThreshold}%), currently at ${(threshold * 100).toFixed(2)}% (${(mailboxSize / 1024 / 1024).toFixed(2)} MB of ${(mailboxQuota / 1024 / 1024).toFixed(2)} MB)</span><br/><span>Please make room in this mailbox, or emails will start to bounce.</span>`
      );
    }
    else if (threshold > warningThreshold) {
      await sendEmail(
        '',
        process.env.EMAIL_TO,
        process.env.EMAIL_FROM,
        `WARNING!! Mailbox quota at has reached warning level for ${mailbox.email}`,
        `<span>The mailbox ${mailbox.email} is currently at a warning level (above ${warningThreshold}%), currently at ${(threshold * 100).toFixed(2)}% (${(mailboxSize / 1024 / 1024).toFixed(2)} MB of ${(mailboxQuota / 1024 / 1024).toFixed(2)} MB)</span><br/><span>Please make room in this mailbox, or emails will start to bounce.</span>`
      );
    }
    else if (threshold > infoThreshold) {
      await sendEmail(
        '',
        process.env.EMAIL_TO,
        process.env.EMAIL_FROM,
        `INFO! Mailbox quota has reached info level for ${mailbox.email}`,
        `<span>The mailbox ${mailbox.email} is currently at an info level (above ${infoThreshold}%), currently at ${(threshold * 100).toFixed(2)}% (${(mailboxSize / 1024 / 1024).toFixed(2)} MB of ${(mailboxQuota / 1024 / 1024).toFixed(2)} MB)</span>`
      );
    }
  }

})();