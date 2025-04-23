import { createTransport } from 'nodemailer';

async function sendTestEmail() {
    // Create a transporter using the SMTP URI
    const transporter = createTransport({
        service: "Gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: 'dev.000.jhon@gmail.com',
            pass: 'eipb fxcz kwtr mffu' 
        }
    });

    try {
        // Send a test email
        const info = await transporter.sendMail({
            from: 'dev0@gmail.com',
            to: 'dev0@gmail.com',
            subject: 'Test Email',
            text: 'This is a test email.'
        });

        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

sendTestEmail();