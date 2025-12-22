import util from "node:util" ;
import { exec } from "node:child_process";
import dayjs from 'dayjs'
import nodemailer from 'nodemailer';

import * as dotenv from 'dotenv';
dotenv.config();

let execute = util.promisify(exec);


(async () => {
const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
const endOfMonth   = dayjs().endOf('month').format('YYYY-MM-DD');

const { stdout, stderr } = await execute(`vnstat -i ${process.env.DEFAULT_NIC} -b ${startOfMonth} -e ${endOfMonth} --json | jq .interfaces[0]`);

console.log(stdout);
})();