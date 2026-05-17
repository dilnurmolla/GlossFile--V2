const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port:Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendMfaEmail(to, code){
    const from = process.env.MFA_FROM || process.env.SMTP_USER;

    const info = await transporter.sendMail({
        from,
        to,
        subject: 'GlossFile Giriş Kodunuz',
        text: `Merhaba, \n\GlossFile hesabınıza giriş için doğrulama kodunuz: ${code}\n\nBu kod 5 dakikak boyunca geçerlidir. \n\nBilginiz dışında talep ettiyseniz, parolanızı değiştirmeniz önerilir.`,
        html: `
        <p>Merhaba,</p>
        <p>GlossFile hesabınıza giriş için doğrulama kodunuz:</p>
        <p style="font-size: 22px; font-weight: bold; letter-spacing: 3px;">${code}</p>
        <p>Bu kod <strong>5 dakika</strong> boyunca geçerlidir.</p>
        <p>Eğer bu isteği siz yapmadıysanız, parolanızı değiştirmeniz önerilir.</p>
        `
        
    });
    console.log('MFA mail gönderildi:', info.messageId);
}

module.exports = {sendMfaEmail};
