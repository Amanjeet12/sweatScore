// Email templates with mustache-style placeholders

export const OTP_EMAIL_TEMPLATE = `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>

    </title>
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding:0; }
      body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
      table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
      img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
      p { display:block;margin:13px 0; }
    </style>
    <!--[if mso]>
    <noscript>
    <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
    </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">
      .mj-outlook-group-fix { width:100% !important; }
    </style>
    <![endif]-->

      <!--[if !mso]><!-->
        <link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css">
        <style type="text/css">
          @import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);
        </style>
      <!--<![endif]-->



    <style type="text/css">
      @media only screen and (min-width:480px) {
        .mj-column-per-100 { width:100% !important; max-width: 100%; }
      }
    </style>
    <style media="screen and (min-width:480px)">
      .moz-text-html .mj-column-per-100 { width:100% !important; max-width: 100%; }
    </style>


    <style type="text/css">



    @media only screen and (max-width:480px) {
      table.mj-full-width-mobile { width: 100% !important; }
      td.mj-full-width-mobile { width: auto !important; }
    }

    </style>
    <style type="text/css">

    </style>

  </head>
  <body style="word-spacing:normal;background-color:white;">


      <div
         style="background-color:white;"
      >
        <!-- Header image -->

      <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->


      <div  style="margin:0px auto;max-width:600px;">

        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:0;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->

      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >

      </div>

          <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>

      </div>


      <!--[if mso | IE]></td></tr></table><![endif]-->

    <!-- Main content -->

      <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="white" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->


      <div  style="background:white;background-color:white;margin:0px auto;max-width:600px;">

        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:white;background-color:white;width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:20px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:560px;" ><![endif]-->

      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >

      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
      >
        <tbody>

              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;padding-bottom:20px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#333333;"
      >Hey!</div>

                </td>
              </tr>

              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;padding-bottom:10px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#333333;"
      >Here's your sign-in code:</div>

                </td>
              </tr>

              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;padding-bottom:30px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:28px;font-weight:bold;line-height:1;text-align:left;color:#333333;"
      ><span class="code-circle">🎯 </span>{{code}}</div>

                </td>
              </tr>

              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;padding-bottom:30px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#333333;"
      >Enter it in the app to finish logging in. Let's get you moving 💪🏾</div>

                </td>
              </tr>

              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;padding-bottom:5px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#666666;"
      >Didn't request this?</div>

                </td>
              </tr>

              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#666666;"
      >If you didn't try to sign in, you can ignore this message.</div>

                </td>
              </tr>

        </tbody>
      </table>

      </div>

          <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>

      </div>


      <!--[if mso | IE]></td></tr></table><![endif]-->

    <!-- Footer -->

      <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#F6F6F6" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->


      <div  style="background:#F6F6F6;background-color:#F6F6F6;margin:0px auto;max-width:600px;">

        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#F6F6F6;background-color:#F6F6F6;width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:20px 20px 20px 20px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:560px;" ><![endif]-->

      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >

      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
      >
        <tbody>

              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                >


     <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" ><tr><td><![endif]-->
              <table
                 align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="float:none;display:inline-table;"
              >
                <tbody>

      <tr

      >
        <td  style="padding:4px;vertical-align:middle;">
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#333333;border-radius:15px;width:30px;"
          >
            <tbody>
              <tr>
                <td  style="font-size:0;height:30px;vertical-align:middle;width:30px;">
                  <a  href="https://www.facebook.com/sharer/sharer.php?u=https://www.facebook.com/sweatscoreapp" target="_blank">
                    <img
                       height="30" src="https://www.mailjet.com/images/theme/v1/icons/ico-social/facebook.png" style="border-radius:15px;display:block;" width="30"
                    />
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </td>

      </tr>

                </tbody>
              </table>
            <!--[if mso | IE]></td><td><![endif]-->
              <table
                 align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="float:none;display:inline-table;"
              >
                <tbody>

      <tr

      >
        <td  style="padding:4px;vertical-align:middle;">
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#333333;border-radius:15px;width:30px;"
          >
            <tbody>
              <tr>
                <td  style="font-size:0;height:30px;vertical-align:middle;width:30px;">
                  <a  href="https://www.instagram.com/sweatscoreapp" target="_blank">
                    <img
                       height="30" src="https://www.mailjet.com/images/theme/v1/icons/ico-social/instagram.png" style="border-radius:15px;display:block;" width="30"
                    />
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </td>

      </tr>

                </tbody>
              </table>
            <!--[if mso | IE]></td></tr></table><![endif]-->


                </td>
              </tr>

              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;padding-bottom:10px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;font-weight:bold;line-height:1;text-align:center;color:#333333;"
      >Need help?</div>

                </td>
              </tr>

              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;padding-bottom:10px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:14px;line-height:1;text-align:center;color:#666666;"
      >Just reply to this email — we've got you.</div>

                </td>
              </tr>

              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;padding-bottom:10px;word-break:break-word;"
                >

      <div
         style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;font-weight:bold;line-height:1;text-align:center;color:#333333;"
      >SweatScore</div>

                </td>
              </tr>

        </tbody>
      </table>

      </div>

          <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>

      </div>


      <!--[if mso | IE]></td></tr></table><![endif]-->


      </div>

  </body>
</html>`;

// Simple mustache-style template replacement utility
export function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
}
