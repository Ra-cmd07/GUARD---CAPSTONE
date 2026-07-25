// Generate self-signed SSL certificates for local HTTPS development
import selfsigned from 'selfsigned';
import fs from 'fs';

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'organizationName', value: 'AttendBox Local Dev' },
];

const opts = {
  keySize: 2048,
  days: 365,
  algorithm: 'sha256',
  extensions: [
    { name: 'basicConstraints', cA: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
        { type: 7, ip: '192.168.1.29' },
      ]
    }
  ]
};

console.log('🔐 Generating SSL certificates...');
const pems = await selfsigned.generate(attrs, opts);

console.log('Keys:', Object.keys(pems));

fs.mkdirSync('certs', { recursive: true });
fs.writeFileSync('certs/localhost.pem', pems.cert);
fs.writeFileSync('certs/localhost-key.pem', pems.private);

console.log('✅ Certificates created:');
console.log('   certs/localhost.pem');
console.log('   certs/localhost-key.pem');
console.log('');
console.log('Now restart the frontend: npm run dev');
console.log('Access via: https://192.168.1.29:3000');
