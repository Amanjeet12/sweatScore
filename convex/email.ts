'use node';

import { v } from 'convex/values';
import nodemailer from 'nodemailer';

import { internalAction } from './_generated/server';

export const sendEmail = internalAction({
  args: {
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
    html: v.string(),
  },
  handler: async (ctx, args) => {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${args.from}>`,
      to: args.to.join(', '),
      subject: args.subject,
      text: args.text,
      html: args.html,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
});
