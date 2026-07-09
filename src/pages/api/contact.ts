import type { APIRoute } from 'astro'
import { Resend } from 'resend'
import { agent, site } from '../../lib/site.config'

const resend = new Resend(import.meta.env.RESEND_API_KEY)

export const POST: APIRoute = async ({ request }) => {

  // Parse the form data from the request body
  const data = await request.formData()
  const name = data.get('name')?.toString().trim()
  const email = data.get('email')?.toString().trim()
  const phone = data.get('phone')?.toString().trim()
  const intent = data.get('intent')?.toString().trim()
  const message = data.get('message')?.toString().trim()

  // Basic validation — return 400 if required fields are missing
  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({ success: false, error: 'Name, email, and message are required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    await resend.emails.send({
      from: `${site.name} <onboarding@resend.dev>`,  // Resend's test sender — works without a verified domain
      to: agent.email,
      replyTo: email,
      subject: `New inquiry from ${name} — ${site.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1612;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #7a7060; width: 140px;">Name</td>
              <td style="padding: 8px 0; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Phone</td>
              <td style="padding: 8px 0;">${phone}</td>
            </tr>` : ''}
            ${intent ? `
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Looking to</td>
              <td style="padding: 8px 0;">${intent}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; color: #7a7060; vertical-align: top;">Message</td>
              <td style="padding: 8px 0;">${message}</td>
            </tr>
          </table>
        </div>
      `
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Resend error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to send message. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}