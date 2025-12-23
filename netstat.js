import util from "node:util" ;
import { exec } from "node:child_process";
import dayjs from 'dayjs'
import nodemailer from 'nodemailer';

import * as dotenv from 'dotenv';
dotenv.config();

let execute = util.promisify(exec);

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
    html,
  });
}


(async () => {
    const startOfMonth = dayjs().subtract(1, 'days').startOf('month').format('YYYY-MM-DD');
    const endOfMonth   = dayjs().subtract(1, 'days').endOf('month').format('YYYY-MM-DD');
    const currentMonth = dayjs(startOfMonth).format('MMMM');

    const { stdout, _ } = await execute(`vnstat -i ${process.env.DEFAULT_NIC} -b ${startOfMonth} -e ${endOfMonth} -d --json | jq .interfaces[0].traffic.day`);

    let days = JSON.parse(stdout);
    let sumTx = 0;
    let sumRx = 0;

    for (const day of days) {
        sumTx += day.tx;
        sumRx += day.rx;
    }

    let sumTxMb = sumTx / 1024 / 1024;
    let sumRxMb = sumRx / 1024 / 1024;

    await sendEmail(
        '',
        process.env.EMAIL_FROM,
        process.env.EMAIL_FROM,
        `Network usage on ${process.env.SMTP_HOST} for ${currentMonth}`,
        `
        <html>
        <head>
        </head>
        <body>
            <span>Network usage on host ${process.env.SMTP_HOST} for ${currentMonth} going through NIC ${process.env.DEFAULT_NIC} is as follows:</span>
            <ul>
                <li>Tx: ${sumTxMb.toFixed(2)} MB</li>
                <li>Rx: ${sumRxMb.toFixed(2)} MB</li>
                <li>Total: ${(sumTxMb + sumRxMb).toFixed(2)} MB</li>
            </ul>

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
    );
})();