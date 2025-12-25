export interface CrashAlertEmail {
  subject: string
  html: string
  text: string
}

export function generateCrashAlertEmail(
  assetName: string,
  assetSymbol: string,
  assetType: "crypto" | "stock",
  currentPrice: number,
  dropPercentage: number,
  threshold: number,
): CrashAlertEmail {
  const formattedPrice = currentPrice.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: assetType === "crypto" && currentPrice < 1 ? 6 : 2,
  })

  const subject = `🚨 ${assetName} Crash Alert: ${dropPercentage.toFixed(2)}% Drop`

  const text = `
CRASH ALERT from eatfear

${assetName} (${assetSymbol}) has dropped significantly!

Current Price: ${formattedPrice}
Drop: ${dropPercentage.toFixed(2)}%
Your Alert Threshold: ${threshold}%

This alert was triggered because the price drop exceeded your configured threshold.

View Dashboard: ${process.env.NEXT_PUBLIC_APP_URL || "https://eatfear.app"}/dashboard

Manage your subscriptions: ${process.env.NEXT_PUBLIC_APP_URL || "https://eatfear.app"}/profile

---
eatfear - Real-time Market Crash Monitoring
  `.trim()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crash Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🚨 Crash Alert
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 22px; font-weight: 600;">
                ${assetName} has dropped significantly!
              </h2>
              
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #991b1b; font-weight: 600;">Asset:</span>
                      <span style="color: #1f2937; font-weight: 500; float: right;">${assetName} (${assetSymbol})</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #991b1b; font-weight: 600;">Current Price:</span>
                      <span style="color: #1f2937; font-weight: 500; float: right;">${formattedPrice}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #991b1b; font-weight: 600;">Price Drop:</span>
                      <span style="color: #dc2626; font-weight: 700; float: right; font-size: 18px;">${dropPercentage.toFixed(2)}%</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #fecaca;">
                      <span style="color: #991b1b; font-weight: 600;">Your Threshold:</span>
                      <span style="color: #6b7280; float: right;">${threshold}%</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 20px 0;">
                This alert was triggered because ${assetName} dropped more than your configured threshold of ${threshold}%.
              </p>
              
              <!-- CTA Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eatfear.app"}/dashboard" 
                       style="display: inline-block; padding: 14px 32px; background-color: #1f2937; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px;">
                      View Dashboard
                    </a>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eatfear.app"}/profile" 
                       style="display: inline-block; padding: 14px 32px; background-color: #f3f4f6; color: #1f2937; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 0 8px;">
                      Manage Alerts
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                <strong>eatfear</strong> - Real-time Market Crash Monitoring
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                You received this email because you subscribed to alerts for ${assetName}.
                <br>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eatfear.app"}/profile" style="color: #6b7280; text-decoration: underline;">
                  Manage your alert preferences
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html, text }
}
