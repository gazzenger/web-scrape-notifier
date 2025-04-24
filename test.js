import {exec as openssl} from 'openssl-wrapper';
import crypto from 'crypto';

// email starttls smtp
openssl('s_client', {'showcerts': true, 'servername': 'mail.server.com', 'connect': 'mail.server.com:25', 'starttls': 'smtp'}, function(err, buffer) {
    const cert = new crypto.X509Certificate(buffer);
    console.log(cert.validTo)
});

// website ssl
openssl('s_client', {'showcerts': true, 'servername': 'website.com', 'connect': 'website.com:443'}, function(err, buffer) {
    const cert = new crypto.X509Certificate(buffer);
    console.log(cert.validTo)
});
