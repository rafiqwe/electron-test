const { emailRect, success } = await wc.executeJavaScript(
  `
  (async () => {
    try {
      await new Promise(r => setTimeout(r, 3000));

      const emailInput = document.querySelector('#email') ||
                        document.querySelector('input[name="email"]') ||
                        document.querySelector('input[placeholder*="Email or phone"]');


      console.log('[FB-LOGIN] Found:', {email: !!emailInput});

      if (!emailInput) return {success: false};

      // Focus email + get bounds for clicking
      emailInput.scrollIntoView({block: 'center'});
      emailInput.focus();
      await new Promise(r => setTimeout(r, 1500));

      passInput.focus();

      return {
        success: true,
        emailRect: emailInput.getBoundingClientRect(),
      };
    } catch(e) {
      return {success: false, error: e.message};
    }
  })();
`,
  true
)

const { passRect, success } = await wc.executeJavaScript(
  `
  (async () => {
    try {
      await new Promise(r => setTimeout(r, 3000));

      const passInput = document.querySelector('#pass') ||
                       document.querySelector('input[name="pass"]') ||
                       document.querySelector('input[type="password"]');

      console.log('[FB-LOGIN] Found:', {pass: !!passInput});

      if (!passInput) return {success: false};

      // Focus email + get bounds for clicking
      passInput.scrollIntoView({block: 'center'});
      passInput.focus();
      await new Promise(r => setTimeout(r, 800));


      return {
        success: true,
        passRect: passInput.getBoundingClientRect(),
      };
    } catch(e) {
      return {success: false, error: e.message};
    }
  })();
`,
  true
)

const { buttonRect, success } = await wc.executeJavaScript(
  `
  (async () => {
    try {
      await new Promise(r => setTimeout(r, 300));

      let loginButton = document.querySelector('[name="login"], [data-testid="royal_login_button"], button[type="submit"]');
      if (!loginButton) {
        loginButton = Array.from(document.querySelectorAll('button, div[role="button"]'))
          .find(el => (el.textContent || '').toLowerCase().match(/log ?in|sign ?in/i));
      }

      console.log('[FB-LOGIN] Found:', {button: !!loginButton});

      // if (!loginButton) return {success: false};

      // Focus email + get bounds for clicking
      loginButton.scrollIntoView({block: 'center'});
      loginButton.focus();
      await new Promise(r => setTimeout(r, 1500));

      return {
        success: true,
        buttonRect: loginButton ? loginButton.getBoundingClientRect() : null
      };
    } catch(e) {
      return {success: false, error: e.message};
    }
  })();
`,
  true
)

