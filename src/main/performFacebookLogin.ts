import { WebContents } from 'electron' // assuming you import this

export async function performFacebookLogin(
  wc: WebContents,
  account: { username: string; password: string }
): Promise<boolean> {
  console.log('[FB-LOGIN] Starting →', account.username)

  // ───────────────────────────────────────────────
  // 1. Locate inputs & button
  // ───────────────────────────────────────────────
  interface FinderResult {
    success: boolean
    emailRect?: DOMRectReadOnly
    passRect?: DOMRectReadOnly
    buttonRect?: DOMRectReadOnly | null
    error?: string
  }

  const result = await wc.executeJavaScript<FinderResult>(
    `
    (async () => {
      try {
        await new Promise(r => setTimeout(r, 2500));

        const emailInput =
          document.querySelector('#email, input[name="email"], input[type="text"][autocomplete="email"], input[placeholder*="email" i], input[placeholder*="phone"])';

        const passInput =
          document.querySelector('#pass, input[name="pass"], input[type="password"]');

        let loginButton = document.querySelector(
          'button[name="login"], [data-testid="royal_login_button"], button[type="submit"], button[data-testid*="login"], div[role="button"] span:has-text("Log")'
        );

        if (!loginButton) {
          loginButton = [...document.querySelectorAll('button, div[role="button"]')]
            .find(el => /log ?in|sign ?in/i.test(el.textContent?.toLowerCase() || ''));
        }

        if (!emailInput || !passInput) {
          return { success: false, error: 'Missing email or password field' };
        }

        emailInput.scrollIntoView({ block: 'center' });

        return {
          success: true,
          emailRect: emailInput.getBoundingClientRect(),
          passRect: passInput.getBoundingClientRect(),
          buttonRect: loginButton?.getBoundingClientRect() ?? null
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })();
  `,
    true
  )

  if (!result.success) {
    console.error('[FB-LOGIN] Field detection failed:', result.error)
    return false
  }

  await delay(600)

  // ───────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────
  const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

  async function sendKeyDown(key: string, code?: string, mods: string[] = []): Promise<void> {
    wc.sendInputEvent({ type: 'keyDown', key, code: code || key, modifiers: mods })
    await delay(35 + Math.random() * 50)
  }

  async function sendKeyUp(key: string, code?: string, mods: string[] = []): Promise<void> {
    wc.sendInputEvent({ type: 'keyUp', key, code: code || key, modifiers: mods })
    await delay(45 + Math.random() * 60)
  }

  async function typeChar(char: string): Promise<void> {
    const isUpper = /[A-Z]/.test(char)
    const lower = char.toLowerCase()
    const code = /[a-zA-Z]/.test(char) ? `Key${lower.toUpperCase()}` : undefined

    await sendKeyDown(char, code, isUpper ? ['shift'] : [])
    wc.sendInputEvent({ type: 'char', key: char, text: char })
    await delay(40 + Math.random() * 70)
    await sendKeyUp(char, code, isUpper ? ['shift'] : [])
    await delay(65 + Math.random() * 110)
  }

  async function typeText(text: string): Promise<void> {
    for (const char of text) {
      await typeChar(char)
    }
  }

  async function clearField(): Promise<void> {
    // Ctrl + A
    await sendKeyDown('Control', 'ControlLeft', ['control'])
    await sendKeyDown('a', 'KeyA', ['control'])
    await sendKeyUp('a', 'KeyA', ['control'])
    await sendKeyUp('Control', 'ControlLeft', ['control'])
    await delay(80)

    // Delete (or Backspace if needed)
    await sendKeyDown('Backspace')
    await sendKeyUp('Backspace')
    await delay(120)
  }

  // ───────────────────────────────────────────────
  // 2. EMAIL
  // ───────────────────────────────────────────────
  wc.focus()
  await delay(450)

  await clearField()
  await typeText(account.username)
  await delay(950)

  // ───────────────────────────────────────────────
  // 3. PASSWORD – force focus via JS
  // ───────────────────────────────────────────────
  await wc.executeJavaScript(
    `
    const pass = document.querySelector('#pass, input[name="pass"], input[type="password"]');
    if (pass) {
      pass.focus();
      pass.dispatchEvent(new FocusEvent('focus', {bubbles: true}));
      pass.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
      pass.scrollIntoView({block: 'center'});
    }
  `,
    true
  )

  await delay(800)

  await clearField()
  await typeText(account.password)
  await delay(1200)

  // Trigger synthetic input events (critical for many React forms)
  await wc.executeJavaScript(
    `
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT')) {
      const val = active.value;
      active.dispatchEvent(new InputEvent('beforeinput', {bubbles: true, cancelable: true, data: val, composed: true}));
      active.dispatchEvent(new InputEvent('input',     {bubbles: true, cancelable: true, data: val, composed: true}));
      active.dispatchEvent(new Event('change',         {bubbles: true}));
    }
  `,
    true
  )

  // ───────────────────────────────────────────────
  // 4. Click button or Enter
  // ───────────────────────────────────────────────
  const { buttonRect } = result

  if (buttonRect && buttonRect.width > 20 && buttonRect.height > 20) {
    const x = Math.round(buttonRect.left + buttonRect.width / 2)
    const y = Math.round(buttonRect.top + buttonRect.height / 2)

    console.log('[FB-LOGIN] Mouse click at ≈', x, y)

    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
    await delay(90 + Math.random() * 80)
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  } else {
    console.log('[FB-LOGIN] No good button rect → sending Enter')
    await sendKeyDown('Enter', 'Enter')
    await sendKeyUp('Enter', 'Enter')
  }

  console.log('[FB-LOGIN] Sequence done')
  return true
}
